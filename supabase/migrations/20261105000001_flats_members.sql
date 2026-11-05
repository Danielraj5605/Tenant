-- Phase 1: flats and members (SPEC §9).
-- Money columns elsewhere are integer paise; none in this migration.

create extension if not exists pgcrypto with schema extensions;

-- Today's date in a flat's timezone. Default flat timezone is Asia/Kolkata.
create or replace function public.flat_today(tz text default 'Asia/Kolkata')
returns date
language sql
stable
as $$
  select (now() at time zone tz)::date
$$;

-- URL-safe random invite code (12 chars).
create or replace function public.new_invite_code()
returns text
language sql
volatile
as $$
  select replace(translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'), '=', '')
$$;

create table public.flats (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 1 and 60),
  timezone        text not null default 'Asia/Kolkata',
  menu_owner_id   uuid,
  prorate_monthly boolean not null default true,
  invite_code     text not null unique default public.new_invite_code(),
  created_at      timestamptz not null default now()
);

create table public.members (
  id          uuid primary key default gen_random_uuid(),
  flat_id     uuid not null references public.flats (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  role        text not null check (role in ('flatmate', 'cook', 'maid')),
  is_admin    boolean not null default false,
  joined_on   date not null default public.flat_today(),
  left_on     date,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),

  -- Cook and maid never log in and are never admins.
  constraint members_staff_no_login check (role = 'flatmate' or (user_id is null and not is_admin)),
  constraint members_left_after_joined check (left_on is null or left_on >= joined_on),
  constraint members_one_per_user unique (flat_id, user_id),
  -- Lets other tables reference (member, flat) pairs so a member can't point at another flat.
  constraint members_id_flat unique (id, flat_id)
);

create index members_user_id_idx on public.members (user_id);
create index members_flat_id_idx on public.members (flat_id, sort_order);

-- The menu owner must be a member of the same flat.
alter table public.flats
  add constraint flats_menu_owner_fk
  foreign key (menu_owner_id, id) references public.members (id, flat_id)
  on delete set null (menu_owner_id)
  deferrable initially deferred;
