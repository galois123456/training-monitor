-- 강화 읽걷쓰 AI 연수 ver1.00 / Supabase SQL Editor에서 전체 실행
begin;
create table if not exists public.training_participants (
 id uuid primary key default gen_random_uuid(),
 school text not null check (char_length(school) between 1 and 100),
 name text not null check (char_length(name) between 1 and 50),
 created_at timestamptz not null default now(), unique(school,name)
);
create table if not exists public.training_activities (
 code text primary key check (char_length(code) between 1 and 40),
 sort_order integer not null unique
);
insert into public.training_activities(code,sort_order)
select 'GH'||lpad(n::text,2,'0'),n from generate_series(1,10) n on conflict do nothing;
create table if not exists public.training_settings (
 id integer primary key check(id=1),
 current_code text not null references public.training_activities(code) on update cascade
);
insert into public.training_settings values(1,'GH01') on conflict do nothing;
create table if not exists public.training_statuses (
 participant_id uuid references public.training_participants on delete cascade,
 code text references public.training_activities(code) on update cascade,
 status text not null check(status in ('Y','N','')),
 updated_at timestamptz not null default now(), primary key(participant_id,code)
);
create table if not exists public.training_questions (
 id uuid primary key,
 participant_id uuid not null references public.training_participants on delete cascade,
 code text not null references public.training_activities(code) on update cascade,
 question text not null default '' check(char_length(question)<=5000),
 image_path text,
 created_at timestamptz not null default now(),
 check(length(trim(question))>0 or image_path is not null)
);
create index if not exists training_questions_lookup on public.training_questions(code,participant_id,created_at);
create table if not exists public.training_rate_limits (
 key text primary key, started_at timestamptz not null, hits integer not null
);
create index if not exists training_rate_limits_time on public.training_rate_limits(started_at);
-- 공개 키로 직접 읽기·쓰기를 금지. Vercel 서버만 service_role 권한으로 접근.
do $$ declare t text; begin
 foreach t in array array['training_participants','training_activities','training_settings','training_statuses','training_questions','training_rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create or replace function public.training_take_rate(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql set search_path=public as $$
declare n integer; begin
 delete from training_rate_limits where started_at < now()-interval '1 day';
 insert into training_rate_limits(key,started_at,hits) values(p_key,now(),1)
 on conflict(key) do update set
 hits=case when training_rate_limits.started_at < now()-make_interval(secs=>p_seconds) then 1 else training_rate_limits.hits+1 end,
 started_at=case when training_rate_limits.started_at < now()-make_interval(secs=>p_seconds) then now() else training_rate_limits.started_at end
 returning hits into n;
 return n<=p_limit;
end $$;

create or replace function public.training_change_code(p_direction text)
returns text language plpgsql set search_path=public as $$
declare current text; target text; pos integer; begin
 if p_direction not in ('next','prev') then raise exception 'Invalid direction'; end if;
 select current_code into current from training_settings where id=1 for update;
 select sort_order into pos from training_activities where code=current;
 if p_direction='next' then
 select code into target from training_activities where sort_order>pos order by sort_order limit 1;
 else
 select code into target from training_activities where sort_order<pos order by sort_order desc limit 1;
 end if;
 target:=coalesce(target,current);
 update training_settings set current_code=target where id=1;
 return target;
end $$;

create or replace function public.training_dashboard()
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('currentCode',s.current_code,
 'hasPrev',exists(select 1 from training_activities where sort_order<a.sort_order),
 'hasNext',exists(select 1 from training_activities where sort_order>a.sort_order),
 'students',coalesce((select jsonb_agg(jsonb_build_object(
 'id',p.id,'school',p.school,'name',p.name,'status',coalesce(st.status,''),
 'questionCount',(select count(*) from training_questions q where q.participant_id=p.id and q.code=s.current_code)
 ) order by p.created_at,p.id) from training_participants p
 left join training_statuses st on st.participant_id=p.id and st.code=s.current_code),'[]'::jsonb))
 from training_settings s join training_activities a on a.code=s.current_code where s.id=1;
$$;
revoke all on function public.training_take_rate(text,integer,integer) from public,anon,authenticated;
revoke all on function public.training_change_code(text) from public,anon,authenticated;
revoke all on function public.training_dashboard() from public,anon,authenticated;
grant execute on function public.training_take_rate(text,integer,integer) to service_role;
grant execute on function public.training_change_code(text) to service_role;
grant execute on function public.training_dashboard() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('training-photos','training-photos',false,2097152,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
commit;
