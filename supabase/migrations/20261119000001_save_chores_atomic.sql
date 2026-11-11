-- Edit chores (all) saves every change in one transaction: deletions, edits,
-- new chores and their rotations. If anything fails, nothing is saved.
-- The app checks the input first (names, days, people in this flat); this
-- function also refuses chores from another flat.
--
-- p = { "deletes": [chore id, ...],
--       "writes":  [{ "id": chore id or null, "name": text, "frequency": text,
--                     "days_of_week": [1..7], "due_time": "HH:MM" or null,
--                     "rotation": [member id, ...] }, ...] }

create or replace function public.save_chores(p_flat_id uuid, p jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  w jsonb;
  cid uuid;
begin
  delete from public.chores
  where flat_id = p_flat_id
    and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p -> 'deletes', '[]'::jsonb)) as x);

  for w in select value from jsonb_array_elements(coalesce(p -> 'writes', '[]'::jsonb)) loop
    cid := null;
    if (w ->> 'id') is not null then
      update public.chores
      set name = w ->> 'name',
          frequency = w ->> 'frequency',
          days_of_week = array(select (d #>> '{}')::smallint from jsonb_array_elements(w -> 'days_of_week') as d),
          due_time = nullif(w ->> 'due_time', '')::time,
          -- This screen edits weekday chores only.
          every_months = null,
          day_of_month = null,
          start_month = null
      where id = (w ->> 'id')::uuid and flat_id = p_flat_id
      returning id into cid;
      if cid is null then
        raise exception 'A chore is no longer in this flat';
      end if;
      delete from public.chore_rotation where chore_id = cid and flat_id = p_flat_id;
    else
      insert into public.chores (flat_id, name, frequency, days_of_week, due_time)
      values (
        p_flat_id,
        w ->> 'name',
        w ->> 'frequency',
        array(select (d #>> '{}')::smallint from jsonb_array_elements(w -> 'days_of_week') as d),
        nullif(w ->> 'due_time', '')::time
      )
      returning id into cid;
    end if;

    insert into public.chore_rotation (chore_id, member_id, flat_id, position)
    select cid, (r.value #>> '{}')::uuid, p_flat_id, (r.ordinality - 1)::smallint
    from jsonb_array_elements(w -> 'rotation') with ordinality as r;
  end loop;
end;
$$;

revoke all on function public.save_chores(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_chores(uuid, jsonb) to service_role;
