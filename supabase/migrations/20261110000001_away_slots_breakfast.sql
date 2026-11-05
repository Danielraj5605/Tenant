-- Part-day away slots and breakfast on the menu.
-- A part-day absence (full_day = false) names the slots missed: morning
-- (breakfast), afternoon (lunch), night (dinner). It only changes meal
-- headcounts and the cook's per-meal "No cook"; chores and money treat the
-- person as home. Full-day absences have no slots.

alter table public.away_periods add column slots text[];

-- Earlier part-day rows didn't say which part: treat them as missing every meal.
update public.away_periods
  set slots = array['morning', 'afternoon', 'night']
  where not full_day;

alter table public.away_periods add constraint away_periods_slots check (
  (full_day and slots is null)
  or (
    not full_day
    and slots is not null
    and cardinality(slots) between 1 and 3
    and slots <@ array['morning', 'afternoon', 'night']
  )
);

alter table public.menu_days
  add column breakfast text check (breakfast is null or char_length(breakfast) <= 80);
