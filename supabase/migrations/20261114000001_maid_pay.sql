-- Maid's pay by days worked, like the cook's: a category's staff_role says whose
-- days worked a "per_day_worked" split counts.

alter table public.expense_categories
  add column staff_role text check (staff_role in ('cook', 'maid'));

-- Existing pay-by-days categories are the cook's.
update public.expense_categories set staff_role = 'cook' where default_rule = 'per_day_worked';

create or replace function public.seed_expense_categories(p_flat_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.expense_categories (flat_id, name, default_rule, staff_role) values
    (p_flat_id, 'Rent', 'all_members', null),
    (p_flat_id, 'WiFi', 'all_members', null),
    (p_flat_id, 'Groceries', 'present_only', null),
    (p_flat_id, 'Gas', 'present_only', null),
    (p_flat_id, 'Household', 'present_only', null),
    (p_flat_id, 'Cook''s pay', 'per_day_worked', 'cook'),
    (p_flat_id, 'Maid''s pay', 'per_day_worked', 'maid')
  on conflict (flat_id, name) do nothing
$$;

revoke all on function public.seed_expense_categories(uuid) from public, anon, authenticated;

-- Every existing flat gets the Maid's pay category.
select public.seed_expense_categories(id) from public.flats;
