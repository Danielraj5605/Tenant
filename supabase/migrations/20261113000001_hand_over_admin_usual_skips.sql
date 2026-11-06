-- Admin gaps: hand admin rights to another flatmate, and meals a person usually skips.

-- Meals someone usually skips (e.g. no breakfast). Only meal headcounts use it;
-- chores and money don't.
alter table public.members
  add column usual_skips text[] not null default '{}'
  check (usual_skips <@ array['breakfast', 'lunch', 'dinner']);

/** The admin makes another current flatmate (with a login) the admin, and stops being admin. */
create or replace function public.hand_over_admin(p_user_id uuid, p_member_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_admin public.members;
  v_target public.members;
begin
  select * into v_target from public.members where id = p_member_id for update;
  if v_target.id is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  select * into v_admin from public.members
  where flat_id = v_target.flat_id and user_id = p_user_id and is_admin and left_on is null
  for update;
  if v_admin.id is null then
    raise exception 'Only the flat admin can do this' using errcode = '42501';
  end if;
  if v_target.id = v_admin.id then
    raise exception 'You are already the admin' using errcode = 'P0001';
  end if;
  if v_target.role <> 'flatmate' or v_target.user_id is null or v_target.left_on is not null then
    raise exception 'Only a current flatmate with a login can be the admin' using errcode = 'P0001';
  end if;

  update public.members set is_admin = true where id = v_target.id;
  update public.members set is_admin = false where id = v_admin.id;
end;
$$;

revoke all on function public.hand_over_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hand_over_admin(uuid, uuid) to service_role;
