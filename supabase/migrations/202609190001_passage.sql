-- PASSAGE: organisation isolation, authoritative compilation snapshots, private evidence.
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text,created_at timestamptz not null default now());
create table public.platform_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.organisations(id uuid primary key default gen_random_uuid(),name text not null,data jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.organisation_members(organisation_id uuid not null references public.organisations(id),user_id uuid not null references auth.users(id),role text not null check(role in ('exporter','consultant','org_admin','platform_admin')),created_at timestamptz not null default now(),primary key(organisation_id,user_id));
create index members_user_idx on public.organisation_members(user_id);
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from platform_admins where user_id=auth.uid()) $$;
create function public.member_role(org uuid) returns text language sql stable security definer set search_path=public as $$ select case when public.is_platform_admin() then 'platform_admin' else (select role from organisation_members where organisation_id=org and user_id=auth.uid()) end $$;
create function public.is_member(org uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.member_role(org) is not null $$;
create table public.countries(code text primary key,name text not null);
insert into public.countries values ('NG','Nigeria'),('GH','Ghana'),('KE','Kenya');
create table public.trade_corridors(id uuid primary key default gen_random_uuid(),origin text not null references countries(code),destination text not null references countries(code),unique(origin,destination),check(origin<>destination));
create table public.rule_sources(id text primary key,data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.rule_packs(id text not null,version text not null,data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(id,version),check(data->>'id'=id),check(data->>'version'=version));
create table public.shipments(id text primary key,organisation_id uuid not null references organisations(id),data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,check(data->>'id'=id),unique(id,organisation_id));
create table public.products(id text primary key,organisation_id uuid not null references organisations(id),data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz);
create table public.saved_documents(id text primary key,organisation_id uuid not null references organisations(id),data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz);
create table public.shipment_compilations(id uuid primary key default gen_random_uuid(),organisation_id uuid not null references organisations(id),shipment_id text not null,sequence integer not null check(sequence>0),data jsonb not null,created_at timestamptz not null default now(),unique(shipment_id,sequence),foreign key(shipment_id,organisation_id) references shipments(id,organisation_id));
create index compilations_org_shipment_idx on shipment_compilations(organisation_id,shipment_id,sequence desc);
create table public.audit_logs(id uuid primary key default gen_random_uuid(),organisation_id uuid references organisations(id),data jsonb not null,created_at timestamptz not null default now());
create table public.notifications(id text primary key,organisation_id uuid not null references organisations(id),data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.consultant_reviews(id text primary key,organisation_id uuid not null references organisations(id),data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.invitations(id text primary key,organisation_id uuid not null references organisations(id),data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());

create unique index invitation_email_idx on public.invitations(organisation_id,lower(data->>'email'));
create index shipments_org_idx on public.shipments(organisation_id);
create index products_org_idx on public.products(organisation_id);
create index saved_documents_org_idx on public.saved_documents(organisation_id);
create index notifications_org_idx on public.notifications(organisation_id);
create index consultant_reviews_org_idx on public.consultant_reviews(organisation_id);
create index invitations_org_idx on public.invitations(organisation_id);
create index audit_logs_org_idx on public.audit_logs(organisation_id);
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.countries enable row level security;
alter table public.trade_corridors enable row level security;
alter table public.rule_sources enable row level security;
alter table public.rule_packs enable row level security;
alter table public.shipments enable row level security;
alter table public.products enable row level security;
alter table public.saved_documents enable row level security;
alter table public.shipment_compilations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.consultant_reviews enable row level security;
alter table public.invitations enable row level security;
create policy member_read on public.shipments for select to authenticated using(public.is_member(organisation_id));
create policy member_read on public.products for select to authenticated using(public.is_member(organisation_id));
create policy member_read on public.saved_documents for select to authenticated using(public.is_member(organisation_id));
create policy member_read on public.shipment_compilations for select to authenticated using(public.is_member(organisation_id));
create policy member_read on public.notifications for select to authenticated using(public.is_member(organisation_id));
create policy member_read on public.consultant_reviews for select to authenticated using(public.is_member(organisation_id));
create policy member_read on public.invitations for select to authenticated using(public.is_member(organisation_id));
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy admin_self on public.platform_admins for select to authenticated using(user_id=auth.uid());
create policy org_read on public.organisations for select to authenticated using(public.is_member(id));
create policy memberships_read on public.organisation_members for select to authenticated using(user_id=auth.uid() or public.member_role(organisation_id) in ('org_admin','platform_admin'));
create policy countries_read on public.countries for select to authenticated using(true);
create policy corridors_read on public.trade_corridors for select to authenticated using(true);
create policy sources_read on public.rule_sources for select to authenticated using(true);
create policy packs_read on public.rule_packs for select to authenticated using(data->>'status'='published' or public.is_platform_admin());
create policy audits_read on public.audit_logs for select to authenticated using(public.is_member(organisation_id) or public.is_platform_admin());
-- Application writes go through checked transactional RPCs, not unrestricted table mutation.
revoke insert,update,delete on all tables in schema public from anon,authenticated;
grant select on all tables in schema public to authenticated;
create function public.immutable_record() returns trigger language plpgsql set search_path=public as $$ begin raise exception 'Immutable record: append a new version'; end $$;
create trigger immutable_compilation before update or delete on shipment_compilations for each row execute function immutable_record();
create trigger immutable_audit before update or delete on audit_logs for each row execute function immutable_record();
create function public.lock_published_pack() returns trigger language plpgsql set search_path=public as $$ begin if old.data->>'status'='published' then raise exception 'Published rule packs are immutable'; end if; return new; end $$;
create trigger immutable_published_pack before update or delete on rule_packs for each row execute function lock_published_pack();
create function public.audit_mutation() returns trigger language plpgsql security definer set search_path=public as $$
declare oid uuid; old_value jsonb; new_value jsonb; audit_id uuid:=gen_random_uuid();
begin
 old_value:=case when tg_op='INSERT' then null else to_jsonb(old) end;new_value:=case when tg_op='DELETE' then null else to_jsonb(new) end;
 oid:=coalesce((new_value->>'organisation_id')::uuid,(old_value->>'organisation_id')::uuid);
 if tg_table_name='organisations' then oid:=(new_value->>'id')::uuid; end if;
 insert into audit_logs(id,organisation_id,data) values(audit_id,oid,jsonb_build_object('id',audit_id,'at',now(),'user',coalesce(auth.uid()::text,'server compiler'),'action',tg_table_name||' '||lower(tg_op),'entity',coalesce(new_value->>'id',old_value->>'id'),'before',old_value,'after',new_value));
 if tg_op='DELETE' then return old; end if;return new;
end $$;
create trigger audit_changes after insert or update on public.shipments for each row execute function public.audit_mutation();
create trigger audit_changes after insert or update on public.products for each row execute function public.audit_mutation();
create trigger audit_changes after insert or update on public.saved_documents for each row execute function public.audit_mutation();
create trigger audit_changes after insert or update on public.organisations for each row execute function public.audit_mutation();
create trigger audit_changes after insert or update on public.rule_packs for each row execute function public.audit_mutation();
create trigger audit_changes after insert or update on public.rule_sources for each row execute function public.audit_mutation();
create trigger audit_changes after insert or update on public.consultant_reviews for each row execute function public.audit_mutation();
create trigger audit_changes after insert or update on public.invitations for each row execute function public.audit_mutation();
create trigger audit_changes after insert or update on public.shipment_compilations for each row execute function public.audit_mutation();
create function public.save_workspace(org_id uuid,previous_state jsonb,next_state jsonb) returns void language plpgsql security definer set search_path=public as $$
declare actor_role text; key text; table_name text; item jsonb; old_item jsonb; current_item jsonb; row_id text; doc jsonb; approved boolean;
begin
 actor_role:=member_role(org_id);if actor_role is null then raise exception 'Organisation access denied'; end if;
 perform pg_advisory_xact_lock(hashtext(org_id::text));
 if pg_column_size(next_state)>10000000 then raise exception 'Workspace payload too large'; end if;
 if next_state->'organisation' is distinct from previous_state->'organisation' then
  if actor_role not in ('org_admin','platform_admin') then raise exception 'Organisation admin required'; end if;
  select data into current_item from organisations where id=org_id for update;
  if current_item is distinct from previous_state->'organisation' then raise exception 'Workspace changed. Reload before saving.'; end if;
  update organisations set data=next_state->'organisation',name=next_state->'organisation'->>'name',updated_at=now() where id=org_id;
 end if;
 foreach key in array array['shipments','products','documents','notifications','reviews','invitations','packs','sources'] loop
  table_name:=case key when 'documents' then 'saved_documents' when 'reviews' then 'consultant_reviews' when 'packs' then 'rule_packs' when 'sources' then 'rule_sources' else key end;
  for item in select value from jsonb_array_elements(coalesce(next_state->key,'[]')) loop
   row_id:=coalesce(item->>'id',case when key='reviews' then md5(item::text) when key='invitations' then md5(lower(item->>'email')||org_id::text) end);
   if row_id is null or length(row_id)>200 then raise exception 'Invalid record ID'; end if;
   select value into old_item from jsonb_array_elements(coalesce(previous_state->key,'[]')) where coalesce(value->>'id',case when key='reviews' then md5(value::text) when key='invitations' then md5(lower(value->>'email')||org_id::text) end)=row_id and (key<>'packs' or value->>'version'=item->>'version');
   if old_item is not distinct from item then continue; end if;
   if key in ('packs','sources') and not is_platform_admin() then raise exception 'Platform admin required'; end if;
   if key='invitations' and actor_role not in ('org_admin','platform_admin') then raise exception 'Organisation admin required'; end if;
   if key='invitations' and (item->>'role' not in ('exporter','consultant','org_admin') or item->>'email' not like '%@%') then raise exception 'Invalid invitation'; end if;
   if key='reviews' and item->>'decision'<>'Requested' and actor_role not in ('consultant','platform_admin') then raise exception 'Consultant required'; end if;
   if key='packs' then
    select data into current_item from rule_packs where id=row_id and version=item->>'version' for update;
   elsif key='sources' then
    select data into current_item from rule_sources where id=row_id for update;
   else
    execute format('select data from public.%I where id=$1 and organisation_id=$2 for update',table_name) into current_item using row_id,org_id;
   end if;
   if current_item is distinct from old_item then raise exception 'Record changed or belongs to another organisation. Reload before saving.'; end if;
   if key='documents' and actor_role='exporter' and item->>'status'='available' and current_item->>'status' is distinct from 'available' then raise exception 'Evidence acceptance requires reviewer'; end if;
   if key='shipments' then
    if (item->>'quantity')::numeric<=0 or (item->>'value')::numeric<=0 or (item->>'weight')::numeric<=0 then raise exception 'Positive quantity, weight, and value required'; end if;
    if item->>'origin'=item->>'destination' then raise exception 'Shipment must cross a border'; end if;
    for doc in select value from jsonb_array_elements(coalesce(item->'documents','[]')) loop
     if doc->>'status'='available' and actor_role='exporter' then
      select exists(select 1 from saved_documents where organisation_id=org_id and data=doc and data->>'status'='available') or exists(select 1 from jsonb_array_elements(coalesce(current_item->'documents','[]')) d where d=doc and d->>'status'='available') into approved;
      if not approved then raise exception 'Evidence acceptance requires reviewer'; end if;
     end if;
    end loop;
   end if;
   if key='packs' then
    insert into rule_packs(id,version,data) values(row_id,item->>'version',item) on conflict(id,version) do update set data=excluded.data,updated_at=now();
   elsif key='sources' then
    insert into rule_sources(id,data) values(row_id,item) on conflict(id) do update set data=excluded.data,updated_at=now();
   else
    execute format('insert into public.%I(id,organisation_id,data) values($1,$2,$3) on conflict(id) do update set data=excluded.data,updated_at=now() where %I.organisation_id=excluded.organisation_id',table_name,table_name) using row_id,org_id,item;
   end if;
  end loop;
 end loop;
end $$;
revoke all on function public.save_workspace(uuid,jsonb,jsonb) from public;
grant execute on function public.save_workspace(uuid,jsonb,jsonb) to authenticated;
-- Provisioning: a user can create an organisation as its administrator, never a platform admin.
create function public.create_organisation(business_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare oid uuid:=gen_random_uuid();begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(business_name))<2 then raise exception 'Business name required'; end if;
 insert into organisations(id,name,data) values(oid,business_name,jsonb_build_object('name',business_name,'country','NG','address','','contact','','registration','','tax',''));
 insert into organisation_members values(oid,auth.uid(),'org_admin',now());return oid;
end $$;
create function public.accept_invitations() returns void language plpgsql security definer set search_path=public as $$
declare invite record;email text;begin
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null then raise exception 'Verified email required';end if;
 for invite in select * from invitations where lower(data->>'email')=email loop
  insert into organisation_members(organisation_id,user_id,role) values(invite.organisation_id,auth.uid(),invite.data->>'role') on conflict do nothing;
 end loop;
end $$;
revoke all on function public.create_organisation(text),public.accept_invitations() from public;
grant execute on function public.create_organisation(text),public.accept_invitations() to authenticated;
-- Private, constrained evidence bucket. Paths must begin with an organisation UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain']) on conflict(id) do nothing;
create policy passage_evidence_read on storage.objects for select to authenticated using(bucket_id='documents' and exists(select 1 from organisations o where o.id::text=(storage.foldername(name))[1] and public.is_member(o.id)));
create policy passage_evidence_upload on storage.objects for insert to authenticated with check(bucket_id='documents' and exists(select 1 from organisations o where o.id::text=(storage.foldername(name))[1] and public.is_member(o.id)));
-- No object overwrite or delete policies: evidence paths are immutable.
-- Compilations can only be inserted by the authenticated Edge Function via service role.
create function public.record_compilation(org_id uuid,shipment_key text,expected_shipment jsonb,result jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare n integer; actual jsonb; cid uuid:=gen_random_uuid();begin
 if auth.role()<>'service_role' then raise exception 'Server compilation required'; end if;
 perform pg_advisory_xact_lock(hashtext(shipment_key));
 select data into actual from shipments where id=shipment_key and organisation_id=org_id for update;
 if actual is null or actual is distinct from expected_shipment then raise exception 'Shipment changed during compilation. Recompile.';end if;
 select coalesce(max(sequence),0)+1 into n from shipment_compilations where shipment_id=shipment_key;
 if (select count(*) from shipment_compilations where organisation_id=org_id and created_at>now()-interval '1 minute')>=30 then raise exception 'Compilation limit reached. Try again in one minute.';end if;
 result:=result||jsonb_build_object('id',cid,'sequence',n,'at',now());
 insert into shipment_compilations(id,organisation_id,shipment_id,sequence,data) values(cid,org_id,shipment_key,n,result);
 update shipments set data=jsonb_set(data,'{draft}','false'),updated_at=now() where id=shipment_key;
 insert into notifications(id,organisation_id,data) values(cid::text,org_id,jsonb_build_object('id',cid,'at',now(),'read',false,'title',shipment_key||': compilation completed'));
 return result;
end $$;
revoke all on function public.record_compilation(uuid,text,jsonb,jsonb) from public;
grant execute on function public.record_compilation(uuid,text,jsonb,jsonb) to service_role;
