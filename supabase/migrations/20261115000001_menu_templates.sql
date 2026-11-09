-- The flat's usual weekly menu: one row per weekday (1 = Monday ... 7 = Sunday).
-- "Use usual menu" on the week planner fills a week from it. The server reads and
-- writes it with the service role, scoped to the signed-in member's flat.

create table public.menu_templates (
  flat_id     uuid not null references public.flats (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),
  breakfast   text check (breakfast is null or char_length(breakfast) <= 80),
  lunch       text check (lunch is null or char_length(lunch) <= 80),
  dinner      text check (dinner is null or char_length(dinner) <= 80),
  updated_at  timestamptz not null default now(),
  primary key (flat_id, weekday)
);

alter table public.menu_templates enable row level security;
revoke all on public.menu_templates from anon, authenticated;
