-- Members admin: a short flat code replaces the invite link, joining needs the
-- admin's approval, and the admin can remove members (history is kept).

-- ---------------------------------------------------------------- flat code
-- 6 characters without look-alikes (no 0/O, 1/I/L), e.g. K7M4QX. Shown as K7M-4QX.
create or replace function public.new_flat_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.flats where flat_code = code);
  end loop;
  return code;
end;
$$;

alter table public.flats add column flat_code text;
update public.flats set flat_code = public.new_flat_code() where flat_code is null;
alter table public.flats
  alter column flat_code set not null,
  alter column flat_code set default public.new_flat_code(),
  add constraint flats_flat_code_key unique (flat_code),
  add constraint flats_flat_code_shape check (flat_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$');

-- The open invite link let anyone join without approval. It is replaced by
-- request_to_join + decide_join_request.
drop function if exists public.join_flat(uuid, text, text);
drop function if exists public.invite_preview(text, uuid);

-- ---------------------------------------------------------------- join requests
create table public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  flat_id     uuid not null references public.flats (id) on delete cascade,
  user_id     uuid not null references public.app_users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  decided_by  uuid references public.members (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- One open request per person at a time.
create unique index join_requests_one_pending on public.join_requests (user_id) where status = 'pending';
create index join_requests_flat_idx on public.join_requests (flat_id, status, created_at desc);

alter table public.join_requests enable row level security;
revoke all on public.join_requests from anon, authenticated;

/** A signed-up person without a flat asks to join by flat code. Returns the flat name. */
create or replace function public.request_to_join(p_user_id uuid, p_code text, p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_flat public.flats;
begin
  if exists (select 1 from public.members where user_id = p_user_id and left_on is null) then
    raise exception 'You already belong to a flat' using errcode = 'P0001';
  end if;
  select * into v_flat from public.flats where flat_code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if v_flat.id is null then
    raise exception 'No flat has this code' using errcode = 'P0002';
  end if;

  update public.join_requests set status = 'cancelled', decided_at = now()
  where user_id = p_user_id and status = 'pending';
  insert into public.join_requests (flat_id, user_id, name) values (v_flat.id, p_user_id, btrim(p_name));
  return v_flat.name;
end;
$$;

/** Admin accepts or declines a pending request. */
create or replace function public.decide_join_request(p_user_id uuid, p_request_id uuid, p_accept boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_req public.join_requests;
  v_admin public.members;
  v_existing public.members;
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

  if exists (select 1 from public.members where user_id = v_req.user_id and left_on is null) then
    update public.join_requests set status = 'cancelled', decided_at = now() where id = v_req.id;
    raise exception 'They already belong to a flat' using errcode = 'P0001';
  end if;

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

/**
 * Admin removes a member. Anyone with history (bills, shares, duties, away days)
 * is marked as left from yesterday so past records stay correct; anyone without
 * history is deleted. Returns 'left' or 'deleted'.
 */
create or replace function public.remove_member(p_user_id uuid, p_member_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_member public.members;
  v_admin public.members;
  v_today date;
begin
  select * into v_member from public.members where id = p_member_id for update;
  if v_member.id is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  select * into v_admin from public.members
  where flat_id = v_member.flat_id and user_id = p_user_id and is_admin and left_on is null;
  if v_admin.id is null then
    raise exception 'Only the flat admin can do this' using errcode = '42501';
  end if;
  if v_member.id = v_admin.id then
    raise exception 'You can''t remove yourself' using errcode = '42501';
  end if;

  if not exists (select 1 from public.away_periods where member_id = v_member.id)
     and not exists (select 1 from public.chore_assignments where member_id = v_member.id)
     and not exists (select 1 from public.expense_shares where member_id = v_member.id)
     and not exists (select 1 from public.expenses where paid_by = v_member.id or created_by = v_member.id)
     and not exists (select 1 from public.expense_items where personal_member_id = v_member.id) then
    delete from public.members where id = v_member.id;
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

do $$
declare f text;
begin
  foreach f in array array[
    'public.request_to_join(uuid, text, text)',
    'public.decide_join_request(uuid, uuid, boolean)',
    'public.remove_member(uuid, uuid)',
    'public.new_flat_code()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
