-- Phase 1: create a flat and join one by invite code.
-- SECURITY DEFINER because a user who is not yet a member cannot read or
-- write `flats` / `members` under RLS.

-- Create a flat; the caller becomes its first member and admin.
create or replace function public.create_flat(p_flat_name text, p_member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_flat_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to create a flat' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = v_uid and left_on is null) then
    raise exception 'You already belong to a flat' using errcode = 'P0001';
  end if;

  insert into public.flats (name)
  values (btrim(p_flat_name))
  returning id into v_flat_id;

  insert into public.members (flat_id, user_id, name, role, is_admin, sort_order)
  values (v_flat_id, v_uid, btrim(p_member_name), 'flatmate', true, 1);

  return v_flat_id;
end;
$$;

-- What an invite link points to, shown before joining.
create or replace function public.invite_preview(p_code text)
returns table (flat_id uuid, flat_name text, flatmate_count integer, already_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.id,
    f.name,
    (select count(*)::integer from public.members m
       where m.flat_id = f.id and m.role = 'flatmate' and m.left_on is null),
    exists (select 1 from public.members m
       where m.flat_id = f.id and m.user_id = (select auth.uid()))
  from public.flats f
  where f.invite_code = p_code
$$;

-- Join the flat behind an invite code as a flatmate. Idempotent.
create or replace function public.join_flat(p_code text, p_member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_flat_id uuid;
  v_existing uuid;
  v_next_order integer;
begin
  if v_uid is null then
    raise exception 'Sign in to join a flat' using errcode = '28000';
  end if;

  select id into v_flat_id from public.flats where invite_code = p_code;
  if v_flat_id is null then
    raise exception 'This invite link is not valid' using errcode = 'P0002';
  end if;

  select flat_id into v_existing
  from public.members
  where user_id = v_uid and left_on is null
  limit 1;

  if v_existing = v_flat_id then
    return v_flat_id;
  elsif v_existing is not null then
    raise exception 'You already belong to another flat' using errcode = 'P0001';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next_order
  from public.members where flat_id = v_flat_id;

  insert into public.members (flat_id, user_id, name, role, is_admin, sort_order)
  values (v_flat_id, v_uid, btrim(p_member_name), 'flatmate', false, v_next_order);

  return v_flat_id;
end;
$$;

revoke all on function public.create_flat(text, text) from public, anon;
revoke all on function public.invite_preview(text) from public, anon;
revoke all on function public.join_flat(text, text) from public, anon;
grant execute on function public.create_flat(text, text) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.join_flat(text, text) to authenticated;
