-- Phase 1: Row Level Security (SPEC §9 constraints).
-- Users read and write only rows of flats they belong to.
-- Only admins edit members and flat settings.

-- Helper functions are SECURITY DEFINER so policies on `members` can look up
-- membership without recursing into their own policy.

create or replace function public.is_flat_member(p_flat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.flats f on f.id = m.flat_id
    where m.flat_id = p_flat_id
      and m.user_id = (select auth.uid())
      and (m.left_on is null or m.left_on >= public.flat_today(f.timezone))
  )
$$;

create or replace function public.is_flat_admin(p_flat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.flats f on f.id = m.flat_id
    where m.flat_id = p_flat_id
      and m.user_id = (select auth.uid())
      and m.is_admin
      and (m.left_on is null or m.left_on >= public.flat_today(f.timezone))
  )
$$;

revoke all on function public.is_flat_member(uuid) from public, anon;
revoke all on function public.is_flat_admin(uuid) from public, anon;
grant execute on function public.is_flat_member(uuid) to authenticated;
grant execute on function public.is_flat_admin(uuid) to authenticated;

alter table public.flats enable row level security;
alter table public.members enable row level security;

-- Nothing is readable without signing in.
revoke all on public.flats from anon;
revoke all on public.members from anon;

-- flats: members read; admins update. Creation goes through create_flat().
create policy flats_select on public.flats
  for select to authenticated
  using (public.is_flat_member(id));

create policy flats_update on public.flats
  for update to authenticated
  using (public.is_flat_admin(id))
  with check (public.is_flat_admin(id));

-- members: members read; admins insert, update, delete.
-- Admins can only add no-login members (cook, maid, or a flatmate placeholder).
-- Anyone with a login joins through join_flat().
create policy members_select on public.members
  for select to authenticated
  using (public.is_flat_member(flat_id));

create policy members_insert on public.members
  for insert to authenticated
  with check (public.is_flat_admin(flat_id) and user_id is null);

create policy members_update on public.members
  for update to authenticated
  using (public.is_flat_admin(flat_id))
  with check (public.is_flat_admin(flat_id));

create policy members_delete on public.members
  for delete to authenticated
  using (public.is_flat_admin(flat_id));

-- Admins must not be able to re-point a member to another user account or
-- another flat through a plain UPDATE.
create or replace function public.members_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.flat_id is distinct from old.flat_id then
    raise exception 'A member cannot be moved to another flat';
  end if;
  if new.user_id is distinct from old.user_id and new.user_id is not null then
    raise exception 'A member''s login cannot be reassigned';
  end if;
  return new;
end;
$$;

create trigger members_guard_update
  before update on public.members
  for each row execute function public.members_guard_update();
