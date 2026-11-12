-- Switching flats: someone who already belongs to a flat can ask to join another
-- one by its code. They stay in their current flat until the other flat's admin
-- accepts; then they leave the old flat and join the new one in one transaction.
-- An admin with other flatmates must hand over admin first.

/**
 * A member leaves their flat (used when they move to another one). Same rule as
 * remove_member: with history they are marked as left from yesterday so past
 * records stay correct; without history the member row is deleted, and a flat
 * left with no members at all is deleted too. Returns 'left' or 'deleted'.
 */
create or replace function public.leave_flat(p_member_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_member public.members;
  v_today date;
begin
  select * into v_member from public.members where id = p_member_id for update;
  if v_member.id is null then
    return 'deleted';
  end if;

  if not exists (select 1 from public.away_periods where member_id = v_member.id)
     and not exists (select 1 from public.chore_assignments where member_id = v_member.id)
     and not exists (select 1 from public.expense_shares where member_id = v_member.id)
     and not exists (select 1 from public.expenses where paid_by = v_member.id or created_by = v_member.id)
     and not exists (select 1 from public.expense_items where personal_member_id = v_member.id) then
    delete from public.members where id = v_member.id;
    if not exists (select 1 from public.members where flat_id = v_member.flat_id) then
      -- Nobody can ever open an empty flat again. If something in it blocks the
      -- delete, the empty flat stays behind, which is harmless.
      begin
        delete from public.flats where id = v_member.flat_id;
      exception when others then
        null;
      end;
    end if;
    return 'deleted';
  end if;

  select public.flat_today(f.timezone) into v_today from public.flats f where f.id = v_member.flat_id;
  update public.members
  set left_on = greatest(joined_on, v_today - 1)
  where id = v_member.id;
  update public.flats set menu_owner_id = null where id = v_member.flat_id and menu_owner_id = v_member.id;
  delete from public.chore_rotation where member_id = v_member.id;
  delete from public.push_subscriptions where member_id = v_member.id;
  return 'left';
end;
$$;

/** True when this member is the admin of a flat that has other current flatmates. */
create or replace function public.is_admin_with_flatmates(p_member public.members)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_member.is_admin and exists (
    select 1 from public.members m
    where m.flat_id = p_member.flat_id and m.id <> p_member.id and m.role = 'flatmate' and m.left_on is null
  )
$$;

/**
 * Ask to join a flat by its code. Works with or without a current flat; with one,
 * accepting the request moves the person. Returns the flat name.
 */
create or replace function public.request_to_join(p_user_id uuid, p_code text, p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_flat public.flats;
  v_current public.members;
begin
  select * into v_flat from public.flats where flat_code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if v_flat.id is null then
    raise exception 'No flat has this code' using errcode = 'P0002';
  end if;

  select * into v_current from public.members
  where user_id = p_user_id and left_on is null
  order by created_at limit 1;
  if v_current.id is not null then
    if v_current.flat_id = v_flat.id then
      raise exception 'You already belong to this flat' using errcode = 'P0001';
    end if;
    if public.is_admin_with_flatmates(v_current) then
      raise exception 'Hand over admin first' using errcode = 'P0001';
    end if;
  end if;

  update public.join_requests set status = 'cancelled', decided_at = now()
  where user_id = p_user_id and status = 'pending';
  insert into public.join_requests (flat_id, user_id, name) values (v_flat.id, p_user_id, btrim(p_name));
  return v_flat.name;
end;
$$;

/** Admin accepts or declines a pending request. Accepting moves a person who is in another flat. */
create or replace function public.decide_join_request(p_user_id uuid, p_request_id uuid, p_accept boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_req public.join_requests;
  v_admin public.members;
  v_existing public.members;
  v_old public.members;
  v_today date;
  v_next integer;
begin
  select * into v_req from public.join_requests where id = p_request_id for update;
  if v_req.id is null or v_req.status <> 'pending' then
    raise exception 'This request was already handled' using errcode = 'P0002';
  end if;

  select * into v_admin from public.members
  where flat_id = v_req.flat_id and user_id = p_user_id and is_admin and left_on is null;
  if v_admin.id is null then
    raise exception 'Only the flat admin can do this' using errcode = '42501';
  end if;

  if not p_accept then
    update public.join_requests set status = 'declined', decided_by = v_admin.id, decided_at = now() where id = v_req.id;
    return;
  end if;

  if exists (select 1 from public.members where flat_id = v_req.flat_id and user_id = v_req.user_id and left_on is null) then
    raise exception 'They already belong to this flat' using errcode = 'P0001';
  end if;

  -- In another flat: they leave it now. An admin can't leave flatmates without one.
  for v_old in
    select * from public.members
    where user_id = v_req.user_id and left_on is null and flat_id <> v_req.flat_id
    for update
  loop
    if public.is_admin_with_flatmates(v_old) then
      raise exception 'They are still the admin of their current flat' using errcode = 'P0001';
    end if;
    perform public.leave_flat(v_old.id);
  end loop;

  select public.flat_today(f.timezone) into v_today from public.flats f where f.id = v_req.flat_id;
  select * into v_existing from public.members where flat_id = v_req.flat_id and user_id = v_req.user_id;
  if v_existing.id is not null then
    -- Coming back after leaving: same member row, so their old history stays theirs.
    update public.members
    set left_on = null, joined_on = v_today, name = v_req.name
    where id = v_existing.id;
  else
    select coalesce(max(sort_order), 0) + 1 into v_next from public.members where flat_id = v_req.flat_id;
    insert into public.members (flat_id, user_id, name, role, is_admin, joined_on, sort_order)
    values (v_req.flat_id, v_req.user_id, v_req.name, 'flatmate', false, v_today, v_next);
  end if;

  update public.join_requests set status = 'accepted', decided_by = v_admin.id, decided_at = now() where id = v_req.id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.leave_flat(uuid)',
    'public.is_admin_with_flatmates(public.members)',
    'public.request_to_join(uuid, text, text)',
    'public.decide_join_request(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
