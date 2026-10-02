-- Additive migration. Existing logs and plans are never deleted or reinterpreted.
alter table public.exercises add column tracking_kind text check (tracking_kind in ('weight','bodyweight','isometric','cardio'));
update public.exercises set tracking_kind = case when stimulus_type = 'Isométrico' then 'isometric' when muscle_group = 'Cardio' then 'cardio' when exercise_type = 'Calistenia' then 'bodyweight' else 'weight' end;

create table public.workout_sessions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 local_date date not null, timezone text not null, status text not null check(status in ('in_progress','completed')),
 payload jsonb not null, revision integer not null default 1, mutation_id uuid not null,
 updated_at timestamptz not null default now()
);
create index workout_sessions_user_date on public.workout_sessions(user_id, local_date desc);
create table public.session_adjustments (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.workout_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, actor_id uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) > 0), before_payload jsonb not null, after_payload jsonb not null,
 created_at timestamptz not null default now()
);
create table public.nutrition_entries (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, local_date date not null,
 payload jsonb not null, updated_at timestamptz not null default now()
);
alter table public.workout_sessions enable row level security;
alter table public.session_adjustments enable row level security;
alter table public.nutrition_entries enable row level security;
create policy sessions_read on public.workout_sessions for select to authenticated using (
 user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.is_trainer_of(auth.uid(), user_id));
create policy adjustments_read on public.session_adjustments for select to authenticated using (
 user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.is_trainer_of(auth.uid(), user_id));
create policy nutrition_read on public.nutrition_entries for select to authenticated using (
 user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.is_trainer_of(auth.uid(), user_id));
create policy nutrition_write on public.nutrition_entries for all to authenticated using (user_id = auth.uid()) with check(user_id = auth.uid());
grant select on public.workout_sessions, public.session_adjustments to authenticated;
grant select,insert,update,delete on public.nutrition_entries to authenticated;
-- Writes are atomic, revision checked and audited; direct session writes are forbidden.
revoke insert,update,delete on public.workout_sessions, public.session_adjustments from authenticated;
create function public.save_workout_session(p_session jsonb, p_expected integer, p_mutation uuid, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare old public.workout_sessions; saved public.workout_sessions; ex jsonb; st jsonb; r jsonb; n integer := 0; owner uuid := (p_session->>'user_id')::uuid;
begin
 if auth.uid() is null or not (auth.uid() = owner or public.has_role(auth.uid(),'admin') or public.is_trainer_of(auth.uid(),owner)) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_session->>'id',0));
 select * into old from public.workout_sessions where id = (p_session->>'id')::uuid for update;
 if found then
   if old.user_id <> owner then raise exception 'Owner cannot change'; end if;
   if old.mutation_id = p_mutation then return to_jsonb(old); end if;
   if old.revision <> p_expected then raise exception 'Revision conflict. Reload before saving.'; end if;
   if old.status = 'completed' and p_session->>'status' <> 'completed' then raise exception 'Cannot reopen completed session'; end if;
   if (old.status = 'completed' or auth.uid() <> owner) and length(trim(p_reason)) = 0 then raise exception 'Reason required'; end if;
 elsif p_expected <> 0 or auth.uid() <> owner then raise exception 'Session missing'; end if;
 if not exists (select 1 from pg_timezone_names where name = p_session->>'timezone') then raise exception 'Invalid timezone'; end if;
 if jsonb_typeof(p_session->'payload'->'exercises') is distinct from 'array' then raise exception 'Invalid exercises'; end if;
 for ex in select * from jsonb_array_elements(p_session->'payload'->'exercises') loop
   if ex->>'kind' not in ('weight','bodyweight','isometric','cardio','legacy') or ex->>'mode' not in ('load','bodyweight','added','assisted') or ex->>'kind' is null or ex->>'mode' is null then raise exception 'Invalid type'; end if;
   if jsonb_typeof(ex->'sets') is distinct from 'array' then raise exception 'Invalid sets'; end if;
   for st in select * from jsonb_array_elements(ex->'sets') loop
     if (st->>'done')::boolean then
       r := st->'actual';
       if (r->>'rpe')::numeric < 1 or (r->>'rpe')::numeric > 10 or (r->>'kg')::numeric < 0 or (r->>'distance')::numeric <= 0 then raise exception 'Invalid result'; end if;
       if ex->>'kind' in ('isometric','cardio') then
         if coalesce((r->>'seconds')::numeric,0) <= 0 then raise exception 'Seconds required'; end if;
       else
         if coalesce((r->>'reps')::numeric,0) <= 0 or (r->>'reps')::numeric <> trunc((r->>'reps')::numeric) then raise exception 'Reps required'; end if;
         if ex->>'mode' <> 'bodyweight' and ex->>'kind' <> 'legacy' and r->>'kg' is null then raise exception 'Load required'; end if;
       end if;
       n := n + 1;
     end if;
   end loop;
 end loop;
 if p_session->>'status' = 'completed' and n = 0 then raise exception 'Empty session'; end if;
 insert into public.workout_sessions(id,user_id,local_date,timezone,status,payload,revision,mutation_id)
 values((p_session->>'id')::uuid,owner,(p_session->>'local_date')::date,p_session->>'timezone',p_session->>'status',p_session->'payload',p_expected+1,p_mutation)
 on conflict(id) do update set local_date=excluded.local_date,timezone=excluded.timezone,status=excluded.status,payload=excluded.payload,revision=excluded.revision,mutation_id=excluded.mutation_id,updated_at=now() returning * into saved;
 if old.id is not null and (old.status = 'completed' or auth.uid() <> owner) then
 insert into public.session_adjustments(session_id,user_id,actor_id,reason,before_payload,after_payload) values(saved.id,owner,auth.uid(),p_reason,old.payload,saved.payload);
 end if;
 return to_jsonb(saved);
end $$;
revoke all on function public.save_workout_session(jsonb,integer,uuid,text) from public,anon;
grant execute on function public.save_workout_session(jsonb,integer,uuid,text) to authenticated;

-- Legacy records retain their original numbers. Unknown type/variant/targets are not invented.
insert into public.workout_sessions(id,user_id,local_date,timezone,status,payload,mutation_id)
select gen_random_uuid(), w.user_id,w.logged_at,'UTC',
 case when exists(select 1 from public.day_completions d where d.user_id=w.user_id and d.completed_at=w.logged_at and d.day_label=w.day_label)
 and bool_or(exists(select 1 from jsonb_array_elements(case when jsonb_typeof(w.sets_completed)='array' then w.sets_completed else '[]'::jsonb end) s where s->>'done'='true' and case when s->>'reps' ~ '^[0-9]+$' then (s->>'reps')::numeric > 0 else false end)) then 'completed' else 'in_progress' end,
 jsonb_build_object('title',w.day_label,'startedAt',w.logged_at::text || 'T12:00:00.000Z','notes','Importado: zona horaria, variante y objetivos originales desconocidos.','legacy',true,'exercises',jsonb_agg(jsonb_build_object(
 'id',w.id,'exerciseId','','name',w.exercise_name,'kind','legacy','variant','','mode','bodyweight','assistance','','muscle','','notes','','legacyRaw',w.sets_completed,
 'sets',(select coalesce(jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'planned',true,'done',(s->>'done'='true' and case when s->>'reps' ~ '^[0-9]+$' then (s->>'reps')::numeric > 0 else false end),'target',jsonb_build_object('reps',null,'kg',null,'seconds',null,'distance',null,'rpe',null),'actual',jsonb_build_object('reps',case when s->>'reps' ~ '^[0-9]+$' then (s->>'reps')::numeric else null end,'kg',case when s->>'weight' ~ '^[0-9]+([.,][0-9]+)?$' then replace(s->>'weight',',','.')::numeric else null end,'seconds',null,'distance',null,'rpe',w.rpe))), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(w.sets_completed)='array' then w.sets_completed else '[]'::jsonb end) s)
 ))),gen_random_uuid()
from public.workout_logs w group by w.user_id,w.logged_at,w.day_label;

-- Trainer-approved targets are append-only. They apply to the next new session,
-- never rewrite completed results or an already started session.
create table public.training_target_adjustments (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references public.workout_sessions(id), exercise_key text not null,
 target_kg numeric not null check(target_kg >= 0), actor_id uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) > 0), created_at timestamptz not null default now()
);
alter table public.training_target_adjustments enable row level security;
create policy targets_read on public.training_target_adjustments for select to authenticated using (
 user_id=auth.uid() or public.has_role(auth.uid(),'admin') or public.is_trainer_of(auth.uid(),user_id));
grant select on public.training_target_adjustments to authenticated;
create function public.approve_training_target(p_id uuid,p_session uuid,p_exercise_key text,p_kg numeric,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare owner uuid;
begin
 select user_id into owner from public.workout_sessions where id=p_session;
 if owner is null or auth.uid() is null or not(public.has_role(auth.uid(),'admin') or public.is_trainer_of(auth.uid(),owner)) then raise exception 'Not authorized'; end if;
 if length(trim(p_reason))=0 then raise exception 'Reason required'; end if;
 if not exists(select 1 from public.workout_sessions s,jsonb_array_elements(s.payload->'exercises') e where s.id=p_session and e->>'kind'='weight' and e->>'mode'='load' and
 (p_exercise_key::jsonb)=jsonb_build_array(coalesce(nullif(e->>'exerciseId',''),e->>'name'),e->>'kind',lower(trim(e->>'variant')),e->>'mode',lower(trim(e->>'assistance')))) then raise exception 'Incompatible exercise'; end if;
 insert into public.training_target_adjustments(id,user_id,session_id,exercise_key,target_kg,actor_id,reason)
 values(p_id,owner,p_session,p_exercise_key,p_kg,auth.uid(),p_reason) on conflict(id) do nothing;
end $$;
revoke all on function public.approve_training_target(uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.approve_training_target(uuid,uuid,text,numeric,text) to authenticated;
