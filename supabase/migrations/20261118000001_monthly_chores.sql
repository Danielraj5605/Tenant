-- Monthly chores: once every N months, due by a day of the month, done by one
-- person (stored as a one-person chore_rotation). Examples: rent and the cook's
-- and maid's salary every month by the 5th; the EB bill every 2 months.
-- Monthly chores keep days_of_week empty, so the daily job's weekday logic
-- never treats them as due; their assignments are created by the app.

alter table public.chores
  add column every_months smallint check (every_months between 1 and 12),
  add column day_of_month smallint check (day_of_month between 1 and 31),
  -- First day of the first month it's due; later ones follow every N months.
  add column start_month date check (start_month is null or extract(day from start_month) = 1);

-- Replace the frequency and days checks (found by definition, not by name).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.chores'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%''custom''%' or conname = 'chores_days')
      and pg_get_constraintdef(oid) not like '%day_of_month%'
      and pg_get_constraintdef(oid) not like '%every_months%'
      and pg_get_constraintdef(oid) not like '%start_month%'
      and pg_get_constraintdef(oid) not like '%char_length%'
      and pg_get_constraintdef(oid) not like '%<@%'
  loop
    execute format('alter table public.chores drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.chores
  add constraint chores_frequency check (frequency in ('daily', 'weekly', 'custom', 'monthly')),
  add constraint chores_days check (frequency in ('daily', 'monthly') or cardinality(days_of_week) >= 1),
  add constraint chores_monthly check (
    (frequency = 'monthly') = (every_months is not null and day_of_month is not null and start_month is not null)
    and (frequency <> 'monthly' or cardinality(days_of_week) = 0)
  );
