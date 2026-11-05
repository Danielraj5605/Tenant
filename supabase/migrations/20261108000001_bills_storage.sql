-- Phase 5: private storage for bill photos at bills/<flat_id>/<uuid>.jpg (SPEC §10).
-- Client compresses to ~200 KB; the bucket caps uploads at 2 MB, JPEG only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bills', 'bills', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- First path segment is the flat id; only that flat's members can touch it.
create or replace function public.bill_flat_id(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid
  end
$$;

create policy bills_select on storage.objects for select to authenticated
  using (bucket_id = 'bills' and public.is_flat_member(public.bill_flat_id(name)));

create policy bills_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'bills' and public.is_flat_member(public.bill_flat_id(name)));

create policy bills_delete on storage.objects for delete to authenticated
  using (bucket_id = 'bills' and owner_id = (select auth.uid())::text);
