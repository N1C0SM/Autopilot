import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role authenticated; create role anon; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table public.assignments(trainer uuid,client uuid);
 create function public.has_role(uuid,text) returns boolean language sql stable as $$select false$$;
 create function public.is_trainer_of(t uuid,u uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.assignments where trainer=t and client=u)$$;
 create table public.exercises(id uuid primary key,name text,stimulus_type text,muscle_group text,exercise_type text);
 create table public.workout_logs(id uuid,user_id uuid,logged_at date,day_label text,exercise_name text,sets_completed jsonb,rpe numeric);
 create table public.day_completions(user_id uuid,completed_at date,day_label text);
 grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;`);
const user = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  trainer = "10000000-0000-4000-8000-000000000003";
await db.exec(`insert into auth.users values('${user}'),('${other}'),('${trainer}');insert into assignments values('${trainer}','${user}');
 insert into workout_logs values(gen_random_uuid(),'${user}','2026-09-01','Martes','Legacy','[{"reps":8,"weight":"40","done":true}]',7);
 insert into day_completions values('${user}','2026-09-01','Martes');`);
await db.exec(
  readFileSync(
    new URL(
      "../supabase/migrations/20261002120000_session_tracking.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const imported = await db.query("select * from workout_sessions");
assert.equal(imported.rows.length, 1);
assert.equal(imported.rows[0].payload.exercises[0].kind, "legacy");
const s = {
  id: "20000000-0000-4000-8000-000000000001",
  user_id: user,
  local_date: "2026-10-02",
  timezone: "Europe/Madrid",
  status: "completed",
  payload: {
    title: "Test",
    startedAt: "2026-10-02T10:00:00Z",
    notes: "",
    exercises: [
      {
        id: "ex",
        exerciseId: "press",
        name: "Press",
        kind: "weight",
        mode: "load",
        variant: "",
        assistance: "",
        muscle: "Pecho",
        notes: "",
        sets: Array.from({ length: 12 }, (_, i) => ({
          id: `s${i}`,
          planned: true,
          done: i < 10,
          target: { reps: 8, kg: 40 },
          actual: { reps: 8, kg: 40, rpe: 7 },
        })),
      },
    ],
  },
};
const call = async (session, revision, mutation, reason = "") =>
  (
    await db.query(
      "select save_workout_session($1::jsonb,$2,$3::uuid,$4) as saved",
      [JSON.stringify(session), revision, mutation, reason],
    )
  ).rows[0].saved;
const login = async (id) => {
  await db.exec("reset role");
  await db.query("select set_config('test.uid',$1,false)", [id]);
  await db.exec("set role authenticated");
};
await login(user);
const m = "30000000-0000-4000-8000-000000000001";
const first = await call(s, 0, m);
assert.equal(first.revision, 1);
assert.equal(first.payload.exercises[0].sets.filter((s) => s.done).length, 10);
const retry = await call(s, 0, m);
assert.equal(retry.revision, 1);
assert.equal((await db.query("select * from workout_sessions")).rows.length, 2);
await assert.rejects(
  () => call(s, 0, "30000000-0000-4000-8000-000000000002", "correction"),
  /Revision conflict/,
);
await assert.rejects(
  () => call(s, 1, "30000000-0000-4000-8000-000000000002"),
  /Reason required/,
);
const corrected = await call(
  s,
  1,
  "30000000-0000-4000-8000-000000000002",
  "Corrección de prueba",
);
assert.equal(corrected.revision, 2);
assert.equal(
  (await db.query("select * from session_adjustments")).rows.length,
  1,
);
await login(other);
assert.equal((await db.query("select * from workout_sessions")).rows.length, 0);
assert.equal(
  (await db.query("select * from session_adjustments")).rows.length,
  0,
);
await assert.rejects(
  () => call(s, 2, "30000000-0000-4000-8000-000000000003", "evil"),
  /Not authorized/,
);
await login(trainer);
assert.equal((await db.query("select * from workout_sessions")).rows.length, 2);
await call(s, 2, "30000000-0000-4000-8000-000000000003", "Revisión entrenador");
await assert.rejects(
  () =>
    db.query("update workout_sessions set payload=$1", [JSON.stringify({})]),
  /permission denied/,
);
await login(user);
const empty = structuredClone(s);
empty.id = "20000000-0000-4000-8000-000000000002";
empty.payload.exercises[0].sets.forEach((s) => (s.done = false));
await assert.rejects(() => call(empty, 0, m), /Empty session/);
empty.status = "in_progress";
await call(empty, 0, m);
const iso = structuredClone(s);
iso.id = "20000000-0000-4000-8000-000000000003";
iso.payload.exercises[0].kind = "isometric";
iso.payload.exercises[0].mode = "bodyweight";
await assert.rejects(() => call(iso, 0, m), /Seconds required/);
iso.payload.exercises[0].sets.forEach((s) => (s.actual = { seconds: 20 }));
await call(iso, 0, m);
await db.query("insert into nutrition_entries values($1,$2,$3,$4,now())", [
  "40000000-0000-4000-8000-000000000001",
  user,
  "2026-10-02",
  "{}",
]);
await login(other);
assert.equal(
  (await db.query("select * from nutrition_entries")).rows.length,
  0,
);
await assert.rejects(
  () =>
    db.query("insert into nutrition_entries values($1,$2,$3,$4,now())", [
      "40000000-0000-4000-8000-000000000002",
      user,
      "2026-10-02",
      "{}",
    ]),
  /row-level security/,
);
// Only assigned staff can approve future targets; owner and unrelated trainer cannot.
const exerciseKey=JSON.stringify(['press','weight','','load','']);
const approve=async()=>db.query('select approve_training_target($1,$2,$3,$4,$5)',['50000000-0000-4000-8000-000000000001',s.id,exerciseKey,42.5,'Objetivos y esfuerzo revisados']);
await login(user);await assert.rejects(approve,/Not authorized/);
await login(other);await assert.rejects(approve,/Not authorized/);
await login(trainer);await approve();await approve();assert.equal((await db.query('select * from training_target_adjustments')).rows.length,1);
await db.exec('reset role');await db.exec('delete from assignments');await login(trainer);assert.equal((await db.query('select * from workout_sessions')).rows.length,0);await assert.rejects(approve,/Not authorized/);
console.log(
  "PASS: migration/backfill, partial 10/12, idempotency, revision conflicts, empty/in-progress sessions, isometric seconds, owner/trainer RLS, audit, nutrition isolation.",
);
await db.close();
