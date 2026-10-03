-- Scope uploaded evidence to the authenticated user's organisation membership.
-- Document metadata remains writable only through save_workspace(), which
-- performs the stale-write and evidence-review checks.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'text/plain']
)
on conflict (id) do nothing;

create or replace function public.can_access_waypoint_document(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organisation_members as member
    where member.user_id = auth.uid()
      and member.organisation_id::text = split_part(object_name, '/', 1)
  );
$$;

revoke all on function public.can_access_waypoint_document(text) from public, anon;
grant execute on function public.can_access_waypoint_document(text) to authenticated;

drop policy if exists waypoint_documents_read on storage.objects;
create policy waypoint_documents_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and public.can_access_waypoint_document(name)
  );

drop policy if exists waypoint_documents_insert on storage.objects;
create policy waypoint_documents_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.can_access_waypoint_document(name)
  );

-- Restrictive scope also constrains any older permissive storage policies
-- left behind by manual SQL experiments. No update/delete policy is granted.
drop policy if exists waypoint_documents_scope on storage.objects;
create policy waypoint_documents_scope
  on storage.objects as restrictive for all to authenticated
  using (
    bucket_id = 'documents'
    and public.can_access_waypoint_document(name)
  )
  with check (
    bucket_id = 'documents'
    and public.can_access_waypoint_document(name)
  );
