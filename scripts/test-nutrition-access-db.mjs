import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated fixtures exercise real RLS as authenticated/anon, not as table owner.
// No network or project database is used.
const db = new PGlite();
const uid = (number) => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const trainer = uid(80);
const admin = uid(81);
const unrelatedTrainer = uid(82);
const clients = [
  { id: uid(1), tier: 'training', status: 'active', end: null, paid: 'paid', payment: null, nutrition: true, chat: false },
  { id: uid(2), tier: 'plus', status: 'trialing', end: '2099-01-01', paid: 'paid', payment: null, nutrition: true, chat: false },
  ...['full', 'transform', 'personal', 'coach'].map((tier, index) => ({ id: uid(index + 3), tier, status: 'active', end: '2099-01-01', paid: 'paid', payment: null, nutrition: true, chat: true })),
  { id: uid(7), tier: 'free', status: 'active', end: null, paid: 'paid', payment: null, nutrition: false, chat: false },
  { id: uid(8), tier: 'full', status: 'active', end: '2000-01-01', paid: 'paid', payment: null, nutrition: false, chat: false },
  { id: uid(9), tier: 'training', status: 'active', end: '2000-01-01', paid: 'paid', payment: null, nutrition: false, chat: false },
  { id: uid(10), tier: 'coach', status: 'canceled', end: null, paid: 'paid', payment: '', nutrition: false, chat: false },
  { id: uid(11), tier: 'personal', status: 'inactive', end: '2000-01-01', paid: 'paid', payment: 'legacy-payment', nutrition: true, chat: true },
  { id: uid(12), tier: 'coach', status: 'active', end: null, paid: 'unpaid', payment: 'legacy-payment', nutrition: false, chat: false },
];
const setUser = async (id) => { await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub='${id}';`); };
const nutritionRows = async (id) => (await db.query('SELECT user_id FROM public.nutrition_plan WHERE user_id=$1', [id])).rows;
const chatRows = async (id) => (await db.query('SELECT conversation_user_id FROM public.chat_messages WHERE conversation_user_id=$1', [id])).rows;
const send = (conversation, sender) => db.query('INSERT INTO public.chat_messages (conversation_user_id, sender_id, content) VALUES ($1,$2,$3)', [conversation, sender, 'fixture']);

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin','trainer','user');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, subscription_tier text, payment_status text, subscription_status text, subscription_end timestamptz, stripe_payment_id text);
    CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
    CREATE TABLE public.trainer_assignments (trainer_id uuid, user_id uuid);
    CREATE TABLE public.nutrition_plan (user_id uuid PRIMARY KEY, meals_json jsonb);
    CREATE TABLE public.chat_messages (conversation_user_id uuid, sender_id uuid, content text);
    CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
    CREATE FUNCTION public.is_trainer_of(_trainer_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.trainer_assignments WHERE trainer_id=_trainer_id AND user_id=_user_id) $$;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Owner profile" ON public.profiles FOR SELECT TO authenticated USING (user_id=auth.uid());
    ALTER TABLE public.nutrition_plan ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Owner nutrition" ON public.nutrition_plan FOR SELECT TO authenticated USING (user_id=auth.uid());
    CREATE POLICY "Admin nutrition" ON public.nutrition_plan FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
    CREATE POLICY "Assigned nutrition" ON public.nutrition_plan FOR SELECT TO authenticated USING (public.is_trainer_of(auth.uid(),user_id));
    ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Own or admin chat" ON public.chat_messages FOR SELECT TO authenticated USING (conversation_user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
    CREATE POLICY "Assigned chat" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_trainer_of(auth.uid(),conversation_user_id));
    CREATE POLICY "Own or admin send" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND (conversation_user_id=auth.uid() OR public.has_role(auth.uid(),'admin')));
    CREATE POLICY "Assigned send" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND public.is_trainer_of(auth.uid(),conversation_user_id));
    GRANT SELECT ON public.profiles, public.nutrition_plan, public.chat_messages TO authenticated, anon;
    GRANT INSERT ON public.chat_messages TO authenticated, anon;
    INSERT INTO public.user_roles VALUES ('${trainer}','trainer'), ('${admin}','admin'), ('${unrelatedTrainer}','trainer');
    INSERT INTO public.chat_messages VALUES ('${trainer}','${admin}','internal fixture');
  `);
  for (const client of clients) {
    await db.query('INSERT INTO public.profiles VALUES ($1,$2,$3,$4,$5,$6)', [client.id, client.tier, client.paid, client.status, client.end, client.payment]);
    await db.query('INSERT INTO public.nutrition_plan VALUES ($1,$2)', [client.id, '[]']);
    await db.query('INSERT INTO public.chat_messages VALUES ($1,$2,$3)', [client.id, admin, 'fixture']);
    await db.query('INSERT INTO public.trainer_assignments VALUES ($1,$2)', [trainer, client.id]);
  }

  // This project fixture intentionally has no earlier restrictive capability
  // policies or has_coaching_access() function, matching a partial deployment.
  const migration = await readFile(new URL('../supabase/migrations/20261010010000_consumer_capability_policies.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  for (const client of clients) {
    await setUser(client.id);
    assert.equal((await nutritionRows(client.id)).length > 0, client.nutrition, `nutrition owner ${client.tier}/${client.status}/${client.end}`);
    assert.equal((await chatRows(client.id)).length > 0, client.chat, `chat owner ${client.tier}/${client.status}/${client.end}`);
    assert.equal((await nutritionRows(clients.find((row) => row.id !== client.id).id)).length, 0, 'cannot read another nutrition plan');
    if (client.chat) await send(client.id, client.id);
    else await assert.rejects(send(client.id, client.id), /row-level security/);
  }

  await setUser(trainer);
  assert.equal((await db.query('SELECT * FROM public.nutrition_plan')).rows.length, clients.length, 'assigned coach can review all assigned nutrition, including Free/expired');
  for (const client of clients) {
    assert.equal((await chatRows(client.id)).length > 0, client.chat, 'assigned chat requires active Coach');
    if (client.chat) await send(client.id, trainer);
    else await assert.rejects(send(client.id, trainer), /row-level security/);
  }
  assert.equal((await chatRows(trainer)).length, 1, 'trainer internal channel readable without consumer plan');
  await send(trainer, trainer);
  await assert.rejects(send(clients[2].id, admin), /row-level security/, 'trainer cannot spoof sender');

  await setUser(unrelatedTrainer);
  assert.equal((await db.query('SELECT * FROM public.nutrition_plan')).rows.length, 0);
  assert.equal((await chatRows(clients[2].id)).length, 0);
  assert.equal((await chatRows(trainer)).length, 0, 'cannot read another trainer internal channel');
  await assert.rejects(send(clients[2].id, unrelatedTrainer), /row-level security/);
  assert.equal((await db.query('SELECT public.has_human_coach_access($1) AS allowed', [clients[2].id])).rows[0].allowed, false, 'helper does not reveal unrelated client entitlement');

  await setUser(admin);
  assert.equal((await db.query('SELECT * FROM public.nutrition_plan')).rows.length, clients.length);
  assert.ok((await chatRows(trainer)).length > 0);
  await send(trainer, admin);
  await send(clients[6].id, admin);
  await assert.rejects(send(trainer, trainer), /row-level security/, 'admin also uses its own sender identity');
  await assert.rejects(db.query('INSERT INTO public.nutrition_plan VALUES ($1,$2)', [uid(500), '[]']), /permission denied/, 'migration adds no nutrition write privilege');

  await db.exec('RESET ROLE; SET ROLE anon;');
  assert.equal((await db.query('SELECT * FROM public.nutrition_plan')).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM public.chat_messages')).rows.length, 0);
  await assert.rejects(send(trainer, trainer), /row-level security/);
  await assert.rejects(db.query('SELECT public.has_active_nutrition_access($1)', [clients[0].id]), /permission denied/);
  await assert.rejects(db.query('SELECT public.has_human_coach_access($1)', [clients[2].id]), /permission denied/);

  await db.exec('RESET ROLE;');
  await db.exec(migration); // Safe if an operator has to reconcile a partial deployment.
  console.log('PASS: active Plus/Coach nutrition, Coach-only human chat, legacy aliases/purchases, expired/Free denial, assigned/admin/internal staff access, sender identity, unrelated/anonymous isolation, no added nutrition write grants.');
} finally { await db.close(); }
