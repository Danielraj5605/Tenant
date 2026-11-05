-- Phase 4: expense ledger (SPEC §4.5, §5.4, §5.5, §9). Money is integer paise.
-- Saved shares are a frozen snapshot: nothing here recomputes them.

create table public.expense_categories (
  id            uuid primary key default gen_random_uuid(),
  flat_id       uuid not null references public.flats (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  default_rule  text not null check (default_rule in ('all_members', 'present_only', 'per_day_worked', 'custom')),
  created_at    timestamptz not null default now(),
  unique (flat_id, name),
  unique (id, flat_id)
);

create table public.expenses (
  id               uuid primary key default gen_random_uuid(),
  flat_id          uuid not null references public.flats (id) on delete cascade,
  category_id      uuid not null,
  title            text not null check (char_length(btrim(title)) between 1 and 80),
  merchant         text check (merchant is null or char_length(merchant) <= 80),
  paid_by          uuid not null,
  total_paise      bigint not null check (total_paise > 0),
  expense_date     date not null,
  source           text not null default 'manual' check (source in ('manual', 'scan')),
  bill_image_path  text,
  rule_note        text check (rule_note is null or char_length(rule_note) <= 200),
  created_by       uuid not null,
  settled          boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (id, flat_id),
  foreign key (category_id, flat_id) references public.expense_categories (id, flat_id),
  foreign key (paid_by, flat_id) references public.members (id, flat_id),
  foreign key (created_by, flat_id) references public.members (id, flat_id)
);

create index expenses_flat_date_idx on public.expenses (flat_id, expense_date desc);

create table public.expense_items (
  id                  uuid primary key default gen_random_uuid(),
  expense_id          uuid not null,
  flat_id             uuid not null,
  name                text not null check (char_length(btrim(name)) between 1 and 80),
  quantity            numeric check (quantity is null or quantity > 0),
  amount_paise        bigint not null check (amount_paise >= 0),
  kind                text not null check (kind in ('item', 'fee', 'tax', 'discount')),
  included            boolean not null default true,
  personal_member_id  uuid,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  foreign key (expense_id, flat_id) references public.expenses (id, flat_id) on delete cascade,
  foreign key (personal_member_id, flat_id) references public.members (id, flat_id)
);

create index expense_items_expense_idx on public.expense_items (expense_id, sort_order);

create table public.expense_shares (
  expense_id    uuid not null,
  member_id     uuid not null,
  flat_id       uuid not null,
  amount_paise  bigint not null check (amount_paise >= 0),
  is_custom     boolean not null default false,
  reason        text check (reason is null or char_length(reason) <= 200),
  created_at    timestamptz not null default now(),
  primary key (expense_id, member_id),
  foreign key (expense_id, flat_id) references public.expenses (id, flat_id) on delete cascade,
  foreign key (member_id, flat_id) references public.members (id, flat_id)
);

create index expense_shares_member_idx on public.expense_shares (member_id);

-- ---------------------------------------------------------------- balance check
-- sum(shares) must equal the split total: ticked items (discounts subtracted),
-- or total_paise when there are no items. Checked at commit.
create or replace function public.check_expense_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.expense_id, old.expense_id);
  v_total bigint;
  v_has_items boolean;
  v_split bigint;
  v_shares bigint;
begin
  select total_paise into v_total from public.expenses where id = v_id;
  if v_total is null then
    return null; -- expense deleted
  end if;
  select exists (select 1 from public.expense_items where expense_id = v_id) into v_has_items;
  if v_has_items then
    select coalesce(sum(case when kind = 'discount' then -amount_paise else amount_paise end), 0)
      into v_split from public.expense_items where expense_id = v_id and included;
  else
    v_split := v_total;
  end if;
  select coalesce(sum(amount_paise), 0) into v_shares from public.expense_shares where expense_id = v_id;
  if v_shares <> v_split then
    raise exception 'Shares (% paise) must add up to the split total (% paise)', v_shares, v_split
      using errcode = '23514';
  end if;
  return null;
end;
$$;

-- The expenses table has no expense_id column, so it gets its own variant.
create or replace function public.check_expense_balanced_expense()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total bigint;
  v_has_items boolean;
  v_split bigint;
  v_shares bigint;
begin
  if tg_op = 'DELETE' then
    return null;
  end if;
  select exists (select 1 from public.expense_items where expense_id = new.id) into v_has_items;
  if v_has_items then
    select coalesce(sum(case when kind = 'discount' then -amount_paise else amount_paise end), 0)
      into v_split from public.expense_items where expense_id = new.id and included;
  else
    v_split := new.total_paise;
  end if;
  select coalesce(sum(amount_paise), 0) into v_shares from public.expense_shares where expense_id = new.id;
  if v_shares <> v_split then
    raise exception 'Shares (% paise) must add up to the split total (% paise)', v_shares, v_split
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger expense_shares_balanced
  after insert or update or delete on public.expense_shares
  deferrable initially deferred
  for each row execute function public.check_expense_balanced();

create constraint trigger expense_items_balanced
  after insert or update or delete on public.expense_items
  deferrable initially deferred
  for each row execute function public.check_expense_balanced();

create constraint trigger expenses_balanced
  after insert or update on public.expenses
  deferrable initially deferred
  for each row execute function public.check_expense_balanced_expense();

-- ---------------------------------------------------------------- RLS
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_shares enable row level security;
revoke all on public.expense_categories, public.expenses, public.expense_items, public.expense_shares from anon;

create policy expense_categories_select on public.expense_categories for select to authenticated
  using (public.is_flat_member(flat_id));
create policy expense_categories_admin on public.expense_categories for all to authenticated
  using (public.is_flat_admin(flat_id)) with check (public.is_flat_admin(flat_id));

-- Expenses, items and shares are readable by the flat. Writes go only through
-- save_expense / set_expense_settled / delete_expense below.
create policy expenses_select on public.expenses for select to authenticated using (public.is_flat_member(flat_id));
create policy expense_items_select on public.expense_items for select to authenticated using (public.is_flat_member(flat_id));
create policy expense_shares_select on public.expense_shares for select to authenticated using (public.is_flat_member(flat_id));

-- ---------------------------------------------------------------- seed categories
create or replace function public.seed_expense_categories(p_flat_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.expense_categories (flat_id, name, default_rule) values
    (p_flat_id, 'Rent', 'all_members'),
    (p_flat_id, 'WiFi', 'all_members'),
    (p_flat_id, 'Groceries', 'present_only'),
    (p_flat_id, 'Gas', 'present_only'),
    (p_flat_id, 'Household', 'present_only'),
    (p_flat_id, 'Cook''s pay', 'per_day_worked')
  on conflict (flat_id, name) do nothing
$$;

revoke all on function public.seed_expense_categories(uuid) from public, anon, authenticated;

select public.seed_expense_categories(id) from public.flats;

-- New flats get the categories too.
create or replace function public.flats_seed_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_expense_categories(new.id);
  return new;
end;
$$;

create trigger flats_seed_categories
  after insert on public.flats
  for each row execute function public.flats_seed_categories();

-- ---------------------------------------------------------------- save
-- Saves an expense with its items and shares in one transaction (SPEC §10.5).
-- Creating: any flatmate. Editing: only the creator, only while unsettled.
create or replace function public.save_expense(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me public.members;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_existing public.expenses;
  v_bad integer;
begin
  select * into v_me from public.members
  where user_id = (select auth.uid()) and left_on is null
  order by created_at limit 1;
  if v_me.id is null then
    raise exception 'Join a flat first' using errcode = '42501';
  end if;

  -- Payer and everyone sharing must be flatmates of this flat.
  select count(*) into v_bad
  from (
    select (p->>'paid_by')::uuid as mid
    union all
    select (s->>'member_id')::uuid from jsonb_array_elements(p->'shares') s
  ) x
  left join public.members m on m.id = x.mid and m.flat_id = v_me.flat_id and m.role = 'flatmate'
  where m.id is null;
  if v_bad > 0 then
    raise exception 'Only flatmates in this flat can pay or share' using errcode = '42501';
  end if;

  if v_id is not null then
    select * into v_existing from public.expenses where id = v_id and flat_id = v_me.flat_id for update;
    if v_existing.id is null then
      raise exception 'Expense not found' using errcode = 'P0002';
    end if;
    if v_existing.created_by <> v_me.id then
      raise exception 'Only the person who created this split can change it' using errcode = '42501';
    end if;
    if v_existing.settled then
      raise exception 'Settled expenses are read-only' using errcode = '42501';
    end if;

    update public.expenses set
      category_id = (p->>'category_id')::uuid,
      title = btrim(p->>'title'),
      merchant = nullif(btrim(p->>'merchant'), ''),
      paid_by = (p->>'paid_by')::uuid,
      total_paise = (p->>'total_paise')::bigint,
      expense_date = (p->>'expense_date')::date,
      rule_note = p->>'rule_note'
    where id = v_id;
    delete from public.expense_items where expense_id = v_id;
    delete from public.expense_shares where expense_id = v_id;
  else
    insert into public.expenses (flat_id, category_id, title, merchant, paid_by, total_paise, expense_date,
                                 source, bill_image_path, rule_note, created_by)
    values (v_me.flat_id, (p->>'category_id')::uuid, btrim(p->>'title'), nullif(btrim(p->>'merchant'), ''),
            (p->>'paid_by')::uuid, (p->>'total_paise')::bigint, (p->>'expense_date')::date,
            coalesce(p->>'source', 'manual'), p->>'bill_image_path', p->>'rule_note', v_me.id)
    returning id into v_id;
  end if;

  insert into public.expense_items (expense_id, flat_id, name, quantity, amount_paise, kind, included,
                                    personal_member_id, sort_order)
  select v_id, v_me.flat_id, btrim(i->>'name'), (i->>'quantity')::numeric, (i->>'amount_paise')::bigint,
         i->>'kind', (i->>'included')::boolean, nullif(i->>'personal_member_id', '')::uuid, (n - 1)::integer
  from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) with ordinality as t(i, n);

  insert into public.expense_shares (expense_id, member_id, flat_id, amount_paise, is_custom, reason)
  select v_id, (s->>'member_id')::uuid, v_me.flat_id, (s->>'amount_paise')::bigint,
         coalesce((s->>'is_custom')::boolean, false), s->>'reason'
  from jsonb_array_elements(p->'shares') s;

  return v_id;
end;
$$;

-- Mark settled (read-only from then on). Creator only.
create or replace function public.set_expense_settled(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.expenses e set settled = true
  from public.members m
  where e.id = p_expense_id and m.id = e.created_by and m.user_id = (select auth.uid());
  if not found then
    raise exception 'Only the person who created this split can mark it settled' using errcode = '42501';
  end if;
end;
$$;

-- Delete an unsettled expense. Creator only.
create or replace function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.expenses e
  using public.members m
  where e.id = p_expense_id and not e.settled and m.id = e.created_by and m.user_id = (select auth.uid());
  if not found then
    raise exception 'Only the creator can delete an unsettled split' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.save_expense(jsonb) from public, anon;
revoke all on function public.set_expense_settled(uuid) from public, anon;
revoke all on function public.delete_expense(uuid) from public, anon;
grant execute on function public.save_expense(jsonb) to authenticated;
grant execute on function public.set_expense_settled(uuid) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
