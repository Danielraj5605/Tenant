-- Replace Supabase Auth with Tenant's own accounts.
-- Accounts: public.app_users (username + scrypt hash). Sessions: signed cookie.
-- All data access goes through the Next.js server with the secret key, which
-- checks permissions in code. The public (publishable/anon) and
-- `authenticated` roles get no access to any table.

-- ---------------------------------------------------------------- accounts
create table public.app_users (
  id               uuid primary key default gen_random_uuid(),
  username         text not null unique check (username ~ '^[a-z0-9._-]{3,20}$'),
  display_name     text not null check (char_length(btrim(display_name)) between 1 and 40),
  password_hash    text not null,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now()
);

-- members.user_id now points at app_users (data was reset, so no rows to move).
alter table public.members drop constraint if exists members_user_id_fkey;
update public.members set user_id = null where user_id is not null
  and user_id not in (select id from public.app_users);
alter table public.members
  add constraint members_user_id_fkey foreign key (user_id) references public.app_users (id) on delete set null;

-- ---------------------------------------------------------------- lock down
-- Drop every RLS policy (they relied on auth.uid()). RLS stays enabled with no
-- policies, so only the service role (server) can read or write.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

drop policy if exists bills_select on storage.objects;
drop policy if exists bills_insert on storage.objects;
drop policy if exists bills_delete on storage.objects;

alter table public.app_users enable row level security;
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Triggers that read auth.uid(); the server now sets created_by and checks
-- the menu owner itself.
drop trigger if exists away_periods_set_creator on public.away_periods;
drop function if exists public.away_periods_set_creator();
drop trigger if exists menu_days_guard on public.menu_days;
drop function if exists public.menu_days_guard();
drop trigger if exists members_guard_update on public.members;
drop function if exists public.members_guard_update();

drop function if exists public.create_flat(text, text);
drop function if exists public.join_flat(text, text);
drop function if exists public.invite_preview(text);
drop function if exists public.set_chore_done(uuid, boolean);
drop function if exists public.save_expense(jsonb);
drop function if exists public.set_expense_settled(uuid);
drop function if exists public.delete_expense(uuid);
drop function if exists public.is_flat_member(uuid);
drop function if exists public.is_flat_admin(uuid);
drop function if exists public.bill_flat_id(text);

-- ---------------------------------------------------------------- functions
-- All take the acting user's id from the server (never from a browser) and are
-- executable only by the service role.

create or replace function public.create_flat(p_user_id uuid, p_flat_name text, p_member_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare v_flat_id uuid;
begin
  if exists (select 1 from public.members where user_id = p_user_id and left_on is null) then
    raise exception 'You already belong to a flat' using errcode = 'P0001';
  end if;
  insert into public.flats (name) values (btrim(p_flat_name)) returning id into v_flat_id;
  insert into public.members (flat_id, user_id, name, role, is_admin, sort_order)
  values (v_flat_id, p_user_id, btrim(p_member_name), 'flatmate', true, 1);
  return v_flat_id;
end;
$$;

create or replace function public.invite_preview(p_code text, p_user_id uuid)
returns table (flat_id uuid, flat_name text, flatmate_count integer, already_member boolean)
language sql
stable
set search_path = ''
as $$
  select f.id, f.name,
    (select count(*)::integer from public.members m
       where m.flat_id = f.id and m.role = 'flatmate' and m.left_on is null),
    exists (select 1 from public.members m where m.flat_id = f.id and m.user_id = p_user_id)
  from public.flats f
  where f.invite_code = p_code
$$;

create or replace function public.join_flat(p_user_id uuid, p_code text, p_member_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_flat_id uuid;
  v_existing uuid;
  v_next integer;
begin
  select id into v_flat_id from public.flats where invite_code = p_code;
  if v_flat_id is null then
    raise exception 'This invite link is not valid' using errcode = 'P0002';
  end if;
  select flat_id into v_existing from public.members where user_id = p_user_id and left_on is null limit 1;
  if v_existing = v_flat_id then
    return v_flat_id;
  elsif v_existing is not null then
    raise exception 'You already belong to another flat' using errcode = 'P0001';
  end if;
  select coalesce(max(sort_order), 0) + 1 into v_next from public.members where flat_id = v_flat_id;
  insert into public.members (flat_id, user_id, name, role, is_admin, sort_order)
  values (v_flat_id, p_user_id, btrim(p_member_name), 'flatmate', false, v_next);
  return v_flat_id;
end;
$$;

create or replace function public.set_chore_done(p_user_id uuid, p_assignment_id uuid, p_done boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.chore_assignments a
  set status = case when p_done then 'done' else 'pending' end,
      done_at = case when p_done then now() else null end
  from public.members m
  where a.id = p_assignment_id and a.member_id = m.id and m.user_id = p_user_id and a.status <> 'skipped';
  if not found then
    raise exception 'Only the person on duty can mark this done' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.save_expense(p_user_id uuid, p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_me public.members;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_existing public.expenses;
  v_bad integer;
begin
  select * into v_me from public.members
  where user_id = p_user_id and left_on is null order by created_at limit 1;
  if v_me.id is null then
    raise exception 'Join a flat first' using errcode = '42501';
  end if;

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

  if not exists (select 1 from public.expense_categories where id = (p->>'category_id')::uuid and flat_id = v_me.flat_id) then
    raise exception 'Unknown category' using errcode = '42501';
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

create or replace function public.set_expense_settled(p_user_id uuid, p_expense_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.expenses e set settled = true
  from public.members m
  where e.id = p_expense_id and m.id = e.created_by and m.user_id = p_user_id;
  if not found then
    raise exception 'Only the person who created this split can mark it settled' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.delete_expense(p_user_id uuid, p_expense_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.expenses e
  using public.members m
  where e.id = p_expense_id and not e.settled and m.id = e.created_by and m.user_id = p_user_id;
  if not found then
    raise exception 'Only the creator can delete an unsettled split' using errcode = '42501';
  end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_flat(uuid, text, text)',
    'public.invite_preview(text, uuid)',
    'public.join_flat(uuid, text, text)',
    'public.set_chore_done(uuid, uuid, boolean)',
    'public.save_expense(uuid, jsonb)',
    'public.set_expense_settled(uuid, uuid)',
    'public.delete_expense(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
