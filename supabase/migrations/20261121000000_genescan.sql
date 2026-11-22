create table public.profiles(id uuid primary key references auth.users on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.dna_sequences(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, name text not null check(length(name) between 1 and 200), bases text not null check(length(bases) between 1 and 100000 and bases !~ '[^ACGTRYSWKMBDHVN]'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id));
create table public.sequence_analyses(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, sequence_id uuid not null, gc numeric, at_pct numeric, composition jsonb not null, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(sequence_id,user_id) references public.dna_sequences(id,user_id) on delete cascade,unique(id,user_id));
create table public.analysis_history(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,analysis_id uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(analysis_id,user_id) references public.sequence_analyses(id,user_id) on delete cascade);
create table public.uploaded_files(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,analysis_id uuid not null,filename text not null check(length(filename) between 1 and 255 and filename ~* '\.(txt|fasta|fa|fna)$'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(analysis_id,user_id) references public.sequence_analyses(id,user_id) on delete cascade);
do $$ declare t text; begin foreach t in array array['profiles','dna_sequences','sequence_analyses','analysis_history','uploaded_files'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from public, anon, authenticated',t);
execute format('grant select on public.%I to authenticated',t);
execute format('create policy own_rows on public.%I for select to authenticated using (%I=(select auth.uid()))',t,case when t='profiles' then 'id' else 'user_id' end);
if t<>'profiles' then execute format('create index on public.%I(user_id,created_at desc)',t);end if;
end loop; end $$;
create function public.save_analysis(label text,bases text,filename text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); sid uuid; aid uuid; counts jsonb; gc int; atn int;
begin
if actor is null then raise exception 'Authentication required';end if;
insert into public.profiles(id) values(actor) on conflict do nothing;
insert into public.dna_sequences(user_id,name,bases) values(actor,label,bases) returning id into sid;
select jsonb_object_agg(b,length(bases)-length(replace(bases,b,''))) into counts from regexp_split_to_table('ACGTRYSWKMBDHVN','') b;
gc:=(counts->>'G')::int+(counts->>'C')::int;atn:=(counts->>'A')::int+(counts->>'T')::int;
insert into public.sequence_analyses(user_id,sequence_id,gc,at_pct,composition) values(actor,sid,100.0*gc/nullif(gc+atn,0),100.0*atn/nullif(gc+atn,0),counts) returning id into aid;
insert into public.analysis_history(user_id,analysis_id) values(actor,aid);
if filename is not null then insert into public.uploaded_files(user_id,analysis_id,filename) values(actor,aid,filename);end if;
return aid;end $$;
revoke all on function public.save_analysis(text,text,text) from public,anon;
grant execute on function public.save_analysis(text,text,text) to authenticated;
