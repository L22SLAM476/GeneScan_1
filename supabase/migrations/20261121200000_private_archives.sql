insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('genescan-private','genescan-private',false,1048576,array['application/json','text/plain'])
on conflict(id) do nothing;

create policy genescan_read on storage.objects for select to authenticated
using (bucket_id='genescan-private' and split_part(name,'/',1)=(select auth.uid())::text);
create policy genescan_insert on storage.objects for insert to authenticated
with check (bucket_id='genescan-private' and split_part(name,'/',1)=(select auth.uid())::text);
create policy genescan_update on storage.objects for update to authenticated
using (bucket_id='genescan-private' and split_part(name,'/',1)=(select auth.uid())::text)
with check (bucket_id='genescan-private' and split_part(name,'/',1)=(select auth.uid())::text);

alter table public.sequence_analyses add column archive_folder text;
create unique index sequence_analyses_archive on public.sequence_analyses(user_id,archive_folder);
create function public.save_archived_analysis(label text,bases text,filename text,folder text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); aid uuid;
begin
  if actor is null or folder is null or folder !~ '^[0-9a-z-]{8,80}$' then raise exception 'Invalid archive'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || '/' || folder,0));
  select id into aid from public.sequence_analyses where user_id=actor and archive_folder=folder;
  if aid is not null then return aid; end if;
  aid:=public.save_analysis(label,bases,filename);
  update public.sequence_analyses set archive_folder=folder where id=aid;
  return aid;
end $$;
revoke all on function public.save_archived_analysis(text,text,text,text) from public,anon;
grant execute on function public.save_archived_analysis(text,text,text,text) to authenticated;
