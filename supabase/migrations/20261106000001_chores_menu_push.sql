-- Phase 3: chores, chore rotation and assignments, menu days, push subscriptions.

-- ---------------------------------------------------------------- chores
create table public.chores (
  id            uuid primary key default gen_random_uuid(),
  flat_id       uuid not null references public.flats (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  frequency     text not null check (frequency in ('daily', 'weekly', 'custom')),
  -- ISO weekdays, 1 = Monday … 7 = Sunday. Empty for daily chores.
  days_of_week  smallint[] not null default '{}'
                check (days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]),
  due_time      time,
  created_at    timestamptz not null default now(),
  constraint chores_days check (frequency = 'daily' or cardinality(days_of_week) >= 1),
  constraint chores_id_flat unique (id, flat_id)
);

create table public.chore_rotation (
  chore_id    uuid not null,
  member_id   uuid not null,
  flat_id     uuid not null,
  position    smallint not null check (position >= 0),
  created_at  timestamptz not null default now(),
  primary key (chore_id, member_id),
  unique (chore_id, position) deferrable initially deferred,
  foreign key (chore_id, flat_id) references public.chores (id, flat_id) on delete cascade,
  foreign key (member_id, flat_id) references public.members (id, flat_id) on delete cascade
);

create table public.chore_assignments (
  id          uuid primary key default gen_random_uuid(),
  chore_id    uuid not null,
  flat_id     uuid not null,
  member_id   uuid,
  due_date    date not null,
  status      text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (chore_id, due_date),
  foreign key (chore_id, flat_id) references public.chores (id, flat_id) on delete cascade,
  foreign key (member_id, flat_id) references public.members (id, flat_id) on delete set null (member_id),
  constraint chore_assignments_skipped check ((status = 'skipped') = (member_id is null))
);

create index chore_assignments_flat_date_idx on public.chore_assignments (flat_id, due_date);
create index chore_assignments_chore_date_idx on public.chore_assignments (chore_id, due_date desc);

alter table public.chores enable row level security;
alter table public.chore_rotation enable row level security;
alter table public.chore_assignments enable row level security;
revoke all on public.chores, public.chore_rotation, public.chore_assignments from anon;

-- Any flatmate can add and edit chores and rotations.
create policy chores_all on public.chores for all to authenticated
  using (public.is_flat_member(flat_id)) with check (public.is_flat_member(flat_id));
create policy chore_rotation_all on public.chore_rotation for all to authenticated
  using (public.is_flat_member(flat_id)) with check (public.is_flat_member(flat_id));

-- Assignments: members read and create (the app fills in today's rows if the
-- daily job hasn't yet). Status changes go through set_chore_done().
create policy chore_assignments_select on public.chore_assignments for select to authenticated
  using (public.is_flat_member(flat_id));
create policy chore_assignments_insert on public.chore_assignments for insert to authenticated
  with check (public.is_flat_member(flat_id) and status <> 'done');

-- Only the person who owns the duty can mark it done (or undo).
create or replace function public.set_chore_done(p_assignment_id uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chore_assignments a
  set status = case when p_done then 'done' else 'pending' end,
      done_at = case when p_done then now() else null end
  from public.members m
  where a.id = p_assignment_id
    and a.member_id = m.id
    and m.user_id = (select auth.uid())
    and a.status <> 'skipped';
  if not found then
    raise exception 'Only the person on duty can mark this done' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_chore_done(uuid, boolean) from public, anon;
grant execute on function public.set_chore_done(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- menu
create table public.menu_days (
  id          uuid primary key default gen_random_uuid(),
  flat_id     uuid not null references public.flats (id) on delete cascade,
  date        date not null,
  lunch       text check (lunch is null or char_length(lunch) <= 80),
  dinner      text check (dinner is null or char_length(dinner) <= 80),
  plan        text not null default 'cook' check (plan in ('cook', 'order_in', 'self_cook')),
  created_at  timestamptz not null default now(),
  unique (flat_id, date)
);

alter table public.menu_days enable row level security;
revoke all on public.menu_days from anon;

create policy menu_days_select on public.menu_days for select to authenticated
  using (public.is_flat_member(flat_id));
create policy menu_days_insert on public.menu_days for insert to authenticated
  with check (public.is_flat_member(flat_id));
create policy menu_days_update on public.menu_days for update to authenticated
  using (public.is_flat_member(flat_id)) with check (public.is_flat_member(flat_id));

-- Only the menu owner plans dishes (the admin stands in while no owner is set).
-- Anyone can choose Order in / We'll cook on a no-cook day.
create or replace function public.menu_days_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_me uuid;
  v_admin boolean;
begin
  if tg_op = 'UPDATE'
     and new.lunch is not distinct from old.lunch
     and new.dinner is not distinct from old.dinner then
    return new;
  end if;
  if tg_op = 'INSERT' and new.lunch is null and new.dinner is null then
    return new;
  end if;

  select f.menu_owner_id into v_owner from public.flats f where f.id = new.flat_id;
  select m.id, m.is_admin into v_me, v_admin
  from public.members m
  where m.flat_id = new.flat_id and m.user_id = (select auth.uid());

  if (v_owner is not null and v_me is distinct from v_owner)
     or (v_owner is null and not coalesce(v_admin, false)) then
    raise exception 'Only the menu owner can plan meals' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger menu_days_guard
  before insert or update on public.menu_days
  for each row execute function public.menu_days_guard();

-- ---------------------------------------------------------------- push
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  flat_id     uuid not null,
  member_id   uuid not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  foreign key (member_id, flat_id) references public.members (id, flat_id) on delete cascade
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;

-- People manage only their own subscriptions. Sending uses the service role.
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.members m
                      where m.id = member_id and m.flat_id = push_subscriptions.flat_id
                        and m.user_id = (select auth.uid())));
