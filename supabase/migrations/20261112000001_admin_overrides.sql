-- Own-data permissions: each flatmate changes their own splits and duties; the
-- flat admin can change anyone's. Same functions as 20261109000001_own_auth,
-- with the admin allowed through.

/** Mark a duty done or not done: the person on duty, or the flat admin. */
create or replace function public.set_chore_done(p_user_id uuid, p_assignment_id uuid, p_done boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.chore_assignments a
  set status = case when p_done then 'done' else 'pending' end,
      done_at = case when p_done then now() else null end
  where a.id = p_assignment_id
    and a.status <> 'skipped'
    and exists (
      select 1 from public.members m
      where m.flat_id = a.flat_id and m.user_id = p_user_id and m.left_on is null
        and (m.id = a.member_id or m.is_admin)
    );
  if not found then
    raise exception 'Only the person on duty can mark this done' using errcode = '42501';
  end if;
end;
$$;

/** Settle a split: its creator, or the flat admin. */
create or replace function public.set_expense_settled(p_user_id uuid, p_expense_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.expenses e set settled = true
  where e.id = p_expense_id
    and exists (
      select 1 from public.members m
      where m.flat_id = e.flat_id and m.user_id = p_user_id and m.left_on is null
        and (m.id = e.created_by or m.is_admin)
    );
  if not found then
    raise exception 'Only the person who created this split can mark it settled' using errcode = '42501';
  end if;
end;
$$;

/** Delete an unsettled split: its creator, or the flat admin. */
create or replace function public.delete_expense(p_user_id uuid, p_expense_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.expenses e
  where e.id = p_expense_id
    and not e.settled
    and exists (
      select 1 from public.members m
      where m.flat_id = e.flat_id and m.user_id = p_user_id and m.left_on is null
        and (m.id = e.created_by or m.is_admin)
    );
  if not found then
    raise exception 'Only the creator can delete an unsettled split' using errcode = '42501';
  end if;
end;
$$;

-- Save a split (new or edit). Editing: its creator, or the flat admin.
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
    if v_existing.created_by <> v_me.id and not v_me.is_admin then
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

do $$
declare f text;
begin
  foreach f in array array[
    'public.set_chore_done(uuid, uuid, boolean)',
    'public.save_expense(uuid, jsonb)',
    'public.set_expense_settled(uuid, uuid)',
    'public.delete_expense(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
