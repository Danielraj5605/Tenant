-- Phase 2: away periods (SPEC §4.2, §9) and menu-owner check.

create table public.away_periods (
  id          uuid primary key default gen_random_uuid(),
  flat_id     uuid not null references public.flats (id) on delete cascade,
  member_id   uuid not null,
  start_date  date not null,
  end_date    date not null,
  full_day    boolean not null default true,
  reason      text check (reason is null or char_length(reason) <= 120),
  created_by  uuid,
  created_at  timestamptz not null default now(),

  constraint away_periods_dates check (end_date >= start_date),
  -- The member must belong to the same flat.
  constraint away_periods_member_fk foreign key (member_id, flat_id)
    references public.members (id, flat_id) on delete cascade,
  constraint away_periods_created_by_fk foreign key (created_by, flat_id)
    references public.members (id, flat_id) on delete set null (created_by)
);

create index away_periods_flat_dates_idx on public.away_periods (flat_id, start_date, end_date);
create index away_periods_member_idx on public.away_periods (member_id, start_date);

-- created_by is always the caller's member row, never client-supplied.
create or replace function public.away_periods_set_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select m.id into new.created_by
    from public.members m
    where m.flat_id = new.flat_id and m.user_id = (select auth.uid())
    limit 1;
  else
    new.created_by := old.created_by;
    if new.flat_id is distinct from old.flat_id then
      raise exception 'An away period cannot be moved to another flat';
    end if;
  end if;
  return new;
end;
$$;

create trigger away_periods_set_creator
  before insert or update on public.away_periods
  for each row execute function public.away_periods_set_creator();

alter table public.away_periods enable row level security;
revoke all on public.away_periods from anon;

-- Any flatmate can mark anyone in the flat away, and edit or delete it.
create policy away_periods_select on public.away_periods
  for select to authenticated using (public.is_flat_member(flat_id));
create policy away_periods_insert on public.away_periods
  for insert to authenticated with check (public.is_flat_member(flat_id));
create policy away_periods_update on public.away_periods
  for update to authenticated
  using (public.is_flat_member(flat_id))
  with check (public.is_flat_member(flat_id));
create policy away_periods_delete on public.away_periods
  for delete to authenticated using (public.is_flat_member(flat_id));

-- The menu owner must be a flatmate (not the cook or maid).
create or replace function public.flats_check_menu_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.menu_owner_id is not null and not exists (
    select 1 from public.members m
    where m.id = new.menu_owner_id and m.flat_id = new.id and m.role = 'flatmate'
  ) then
    raise exception 'The menu owner must be a flatmate in this flat';
  end if;
  return new;
end;
$$;

create trigger flats_check_menu_owner
  before insert or update of menu_owner_id on public.flats
  for each row execute function public.flats_check_menu_owner();
