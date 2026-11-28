// Importa una rutina (JSON de DayPlan[]) al plan activo del usuario.
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... USER_EMAIL=... node scripts/import-routine.mjs docs/safety-routine.json
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const email = process.env.USER_EMAIL;
const file = process.argv[2];
if (!url || !key || !email || !file) {
  console.error("Faltan vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, USER_EMAIL, y el archivo JSON");
  process.exit(1);
}

const supabase = createClient(url, key);
const { data: auth } = await supabase.auth.signInWithPassword({ email, password: process.env.USER_PASSWORD || "" });
if (!auth?.user) { console.error("Login fallido"); process.exit(1); }
const userId = auth.user.id;

const routine = JSON.parse(readFileSync(file, "utf8"));
// Añadir routine_id compartido
const rid = crypto.randomUUID();
const plans = routine.map((d) => ({ ...d, routine_id: rid, custom: true }));

// Fetch plan actual
const { data: rows } = await supabase.from("training_plan").select("workouts_json").eq("user_id", userId).limit(1);
const current = rows?.[0]?.workouts_json || [];
const merged = [...current.filter((p) => !plans.some((n) => n.day === p.day)), ...plans];

const { error } = await supabase.from("training_plan").upsert({ user_id: userId, workouts_json: merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
if (error) { console.error("Error:", error); process.exit(1); }
console.log(`Importada rutina "${plans[0].routine_name}" con ${plans.length} días para ${email}`);
