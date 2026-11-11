-- Order in / We'll cook per meal instead of per day. meal_plans maps a meal
-- ("breakfast", "lunch", "dinner") to "cook", "order_in" or "self_cook". A meal
-- that isn't in it follows the day's plan, so existing choices keep working.

create or replace function public.valid_meal_plans(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_each_text(p) as e
      where e.key not in ('breakfast', 'lunch', 'dinner') or e.value not in ('cook', 'order_in', 'self_cook')
    )
$$;

alter table public.menu_days
  add column meal_plans jsonb not null default '{}'::jsonb
  check (public.valid_meal_plans(meal_plans));
