import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`CREATE TABLE public.nutrition_plan (id integer PRIMARY KEY, macros_json jsonb, meals_json jsonb);
    INSERT INTO public.nutrition_plan VALUES (1, '{"protein":50,"carbs":100,"fats":500}', '[]');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261009150000_nutrition_input_review.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query(`SELECT macros_json->>'fats' AS fats FROM public.nutrition_plan WHERE id=1`)).rows[0].fats, '500');
  await assert.rejects(db.exec(`INSERT INTO public.nutrition_plan VALUES (2, '{"protein":50,"carbs":100,"fats":500}', '[]')`), /nutrition_plan_targets_review/);
  await assert.rejects(db.exec(`INSERT INTO public.nutrition_plan VALUES (3, '{"protein":140,"carbs":220,"fats":65,"calories":5000}', '[]')`), /nutrition_plan_targets_review/);
  await assert.rejects(db.exec(`INSERT INTO public.nutrition_plan VALUES (4, '{"protein":140}', '[]')`), /nutrition_plan_targets_review/);
  await assert.rejects(db.exec(`INSERT INTO public.nutrition_plan VALUES (5, '[]', '[]')`), /nutrition_plan_targets_review/);
  await db.exec(`INSERT INTO public.nutrition_plan VALUES (6, '{"protein":"140","carbs":220,"fats":65,"calories":2025}', '[]'), (7, '{}', '[]');
    UPDATE public.nutrition_plan SET macros_json='{"protein":140,"carbs":220,"fats":65}' WHERE id=1;`);
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.nutrition_plan')).rows[0].count, 3);
  console.log('PASS: legacy targets preserved; invalid new writes rejected; missing/valid targets accepted; review correction accepted.');
} finally { await db.close(); }
