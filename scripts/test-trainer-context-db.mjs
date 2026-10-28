import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const client = '00000000-0000-0000-0000-000000000011';
const otherClient = '00000000-0000-0000-0000-000000000012';
const trainer = '00000000-0000-0000-0000-000000000021';
const otherTrainer = '00000000-0000-0000-0000-000000000022';
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE public.profiles(id uuid, user_id uuid, email text, name text, avatar_url text, plan_status text, payment_status text, referral_code text, referred_by text, travel_mode_until date, travel_equipment text, created_at timestamptz, updated_at timestamptz, subscription_tier text, subscription_status text, subscription_end timestamptz, stripe_payment_id text);
    CREATE TABLE public.trainer_assignments(user_id uuid, trainer_id uuid);
    CREATE FUNCTION public.get_trainer_assigned_profiles() RETURNS SETOF public.profiles LANGUAGE sql AS $$ SELECT * FROM public.profiles WHERE false $$;
    INSERT INTO public.profiles (id,user_id,email,subscription_tier,payment_status,subscription_status,stripe_payment_id) VALUES
      ('${client}','${client}','client@example.invalid','full','paid','active','private-stripe-reference'),
      ('${otherClient}','${otherClient}','other@example.invalid','training','paid','active',null);
    INSERT INTO public.trainer_assignments VALUES ('${client}','${trainer}'),('${otherClient}','${otherTrainer}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261009160000_trainer_client_billing_context.sql', import.meta.url), 'utf8'));
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${trainer}';`);
  const rows = (await db.query('SELECT user_id, subscription_tier, subscription_status, stripe_payment_id FROM public.get_trainer_assigned_profiles()')).rows;
  assert.equal(rows.length,1); assert.equal(rows[0].user_id,client); assert.equal(rows[0].subscription_tier,'full'); assert.equal(rows[0].subscription_status,'active'); assert.equal(rows[0].stripe_payment_id,'legacy_purchase');
  await assert.rejects(db.query('SELECT * FROM public.profiles'), /permission denied/);
  await db.exec(`SET request.jwt.claim.sub='${otherTrainer}';`);
  assert.equal((await db.query('SELECT user_id FROM public.get_trainer_assigned_profiles()')).rows[0].user_id,otherClient);
  await db.exec(`SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000099';`);
  assert.equal((await db.query('SELECT * FROM public.get_trainer_assigned_profiles()')).rows.length,0);
  await db.exec('RESET ROLE; SET ROLE anon;');
  await assert.rejects(db.query('SELECT * FROM public.get_trainer_assigned_profiles()'), /permission denied/);
  console.log('PASS: only assigned client returned; billing context included; payment reference masked; table access and anonymous RPC denied.');
} finally { await db.close(); }
