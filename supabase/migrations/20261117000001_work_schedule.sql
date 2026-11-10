-- Weekly work schedule for the cook and maid: 7 entries, Monday first, each
-- { mode: every | alternate | off, meals: [...], anchor: date | null }.
-- Null means every day, every meal (the behaviour before this column existed).
-- Validated in the app (lib/engine/inputs.ts); the database checks the shape.

alter table public.members
  add column work_schedule jsonb
  check (
    work_schedule is null
    or (jsonb_typeof(work_schedule) = 'array' and jsonb_array_length(work_schedule) = 7)
  );

alter table public.members
  add constraint members_schedule_staff_only check (work_schedule is null or role <> 'flatmate');
