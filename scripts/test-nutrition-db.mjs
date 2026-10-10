import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.nutrition_plan (id integer PRIMARY KEY, macros_json jsonb, meals_json jsonb, updated_at timestamptz);
    INSERT INTO public.nutrition_plan VALUES (1, '{"protein":50,"carbs":100,"fats":500}', '[]');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261009150000_nutrition_input_review.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261010011000_nutrition_legacy_updates.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261010011000_nutrition_legacy_updates.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query(`SELECT macros_json->>'fats' AS fats FROM public.nutrition_plan WHERE id=1`)).rows[0].fats, '500');
  await db.exec(`UPDATE public.nutrition_plan SET meals_json='[{"name":"Reviewed meal"}]', updated_at=now() WHERE id=1`);
  const legacy = (await db.query(`SELECT macros_json->>'fats' AS fats, meals_json->0->>'name' AS meal FROM public.nutrition_plan WHERE id=1`)).rows[0];
  assert.deepEqual(legacy, { fats: '500', meal: 'Reviewed meal' });
  const rejected = async (sql) => assert.rejects(db.exec(sql), (error) => error.code === '23514' && error.constraint === 'nutrition_plan_targets_review');
  await rejected(`INSERT INTO public.nutrition_plan (id,macros_json,meals_json) VALUES (2, '{"protein":50,"carbs":100,"fats":500}', '[]')`);
  await rejected(`INSERT INTO public.nutrition_plan (id,macros_json,meals_json) VALUES (3, '{"protein":140,"carbs":220,"fats":65,"calories":5000}', '[]')`);
  await rejected(`INSERT INTO public.nutrition_plan (id,macros_json,meals_json) VALUES (4, '{"protein":140}', '[]')`);
  await rejected(`INSERT INTO public.nutrition_plan (id,macros_json,meals_json) VALUES (5, '[]', '[]')`);
  await rejected(`UPDATE public.nutrition_plan SET macros_json='{"protein":55,"carbs":100,"fats":500}' WHERE id=1`);
  await db.exec(`INSERT INTO public.nutrition_plan VALUES (6, '{"protein":"140","carbs":220,"fats":65,"calories":2025}', '[]'), (7, '{}', '[]');
    UPDATE public.nutrition_plan SET macros_json='{"protein":140,"carbs":220,"fats":65}' WHERE id=1;`);
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.nutrition_plan')).rows[0].count, 3);
  console.log('PASS: unchanged legacy targets allow meal/metadata edits; invalid inserts and changed targets rejected; valid correction accepted; trigger migration idempotent.');
} finally { await db.close(); }
