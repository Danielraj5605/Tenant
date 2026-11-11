-- Swapping chore days within a rotation.
--
-- chore_assignments.rotation_member_id: whose turn the rotation gave this day
-- (null = member_id). After a swap, member_id is who actually does it while the
-- rotation keeps counting from rotation_member_id, so a swap doesn't shift
-- anyone else's days.
--
-- chore_swaps: one person asks to trade one of their days for someone else's
-- day on the same chore; the other person accepts or declines.

alter table public.chore_assignments
  add column rotation_member_id uuid,
  add constraint chore_assignments_rotation_member_fk
    foreign key (rotation_member_id, flat_id) references public.members (id, flat_id) on delete set null (rotation_member_id);

create table public.chore_swaps (
  id           uuid primary key default gen_random_uuid(),
  flat_id      uuid not null references public.flats (id) on delete cascade,
  chore_id     uuid not null,
  from_member  uuid not null,
  from_date    date not null,
  to_member    uuid not null,
  to_date      date not null,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  constraint chore_swaps_two_people check (from_member <> to_member),
  constraint chore_swaps_two_days check (from_date <> to_date),
  foreign key (chore_id, flat_id) references public.chores (id, flat_id) on delete cascade,
  foreign key (from_member, flat_id) references public.members (id, flat_id) on delete cascade,
  foreign key (to_member, flat_id) references public.members (id, flat_id) on delete cascade
);

create index chore_swaps_flat_status_idx on public.chore_swaps (flat_id, status);

-- One open request per day of a chore.
create unique index chore_swaps_one_pending_from on public.chore_swaps (chore_id, from_date) where status = 'pending';
create unique index chore_swaps_one_pending_to on public.chore_swaps (chore_id, to_date) where status = 'pending';

alter table public.chore_swaps enable row level security;
revoke all on public.chore_swaps from anon, authenticated;

-- Accepting a swap: both days change hands and the request is marked accepted,
-- in one transaction. The app checks first that both turns still hold;
-- p_*_rotation keep whose turn each day was, so the rotation doesn't shift.
create or replace function public.accept_chore_swap(
  p_swap_id uuid,
  p_from_rotation uuid,
  p_to_rotation uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s public.chore_swaps;
begin
  select * into s from public.chore_swaps where id = p_swap_id and status = 'pending' for update;
  if not found then
    raise exception 'This swap is no longer open';
  end if;

  -- Your day goes to them, their day to you.
  insert into public.chore_assignments (chore_id, flat_id, member_id, due_date, status, rotation_member_id)
  values (s.chore_id, s.flat_id, s.to_member, s.from_date, 'pending', p_from_rotation)
  on conflict (chore_id, due_date) do update
    set member_id = excluded.member_id, status = 'pending', done_at = null, rotation_member_id = excluded.rotation_member_id;

  insert into public.chore_assignments (chore_id, flat_id, member_id, due_date, status, rotation_member_id)
  values (s.chore_id, s.flat_id, s.from_member, s.to_date, 'pending', p_to_rotation)
  on conflict (chore_id, due_date) do update
    set member_id = excluded.member_id, status = 'pending', done_at = null, rotation_member_id = excluded.rotation_member_id;

  update public.chore_swaps set status = 'accepted', decided_at = now() where id = p_swap_id;
end;
$$;

revoke all on function public.accept_chore_swap(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_chore_swap(uuid, uuid, uuid) to service_role;
