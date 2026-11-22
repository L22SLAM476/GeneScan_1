alter table public.profiles add column display_name text, add column email text;

create function public.sync_genescan_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, email)
  values(new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),
    nullif(trim(new.raw_user_meta_data->>'full_name'),''), nullif(trim(new.raw_user_meta_data->>'name'),''),
    nullif(split_part(new.email,'@',1),''), 'GeneScan user'),120), new.email)
  on conflict(id) do update set display_name=excluded.display_name, email=excluded.email, updated_at=now();
  return new;
end $$;
revoke all on function public.sync_genescan_profile() from public, anon, authenticated;
create trigger sync_genescan_profile after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_genescan_profile();

insert into public.profiles(id,display_name,email)
select id,left(coalesce(nullif(trim(raw_user_meta_data->>'display_name'),''),
  nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),
  nullif(split_part(email,'@',1),''),'GeneScan user'),120),email from auth.users
on conflict(id) do update set display_name=excluded.display_name,email=excluded.email,updated_at=now();

create view public.genescan_activity with (security_invoker=true) as
select a.id as analysis_id, a.created_at as analyzed_at, a.user_id, p.display_name, p.email,
  s.name as sequence_name, length(s.bases) as sequence_length, a.gc as gc_percent,
  a.at_pct as at_percent, a.composition, f.filename
from public.sequence_analyses a join public.profiles p on p.id=a.user_id
join public.dna_sequences s on s.id=a.sequence_id and s.user_id=a.user_id
left join public.uploaded_files f on f.analysis_id=a.id and f.user_id=a.user_id;
revoke all on public.genescan_activity from public, anon, authenticated;
grant select on public.genescan_activity to authenticated;
