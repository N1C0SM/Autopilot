import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type AccountKind = "client_training" | "client_full" | "client_transform" | "trainer" | "admin";

const ACCOUNT_KINDS = new Set<AccountKind>([
  "client_training",
  "client_full",
  "client_transform",
  "trainer",
  "admin",
]);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const generatePassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*-_";
  const all = upper + lower + digits + symbols;
  const random = new Uint32Array(24);
  crypto.getRandomValues(random);

  const password = [
    upper[random[0] % upper.length],
    lower[random[1] % lower.length],
    digits[random[2] % digits.length],
    symbols[random[3] % symbols.length],
    ...Array.from(random.slice(4), (value) => all[value % all.length]),
  ];

  for (let i = password.length - 1; i > 0; i--) {
    const j = random[i % random.length] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  return password.join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase server configuration");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = authHeader.slice("Bearer ".length);
    const { data: caller, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller.user) return jsonResponse({ error: "Sesión no válida" }, 401);

    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", {
      _user_id: caller.user.id,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) return jsonResponse({ error: "Solo un administrador puede crear cuentas de prueba" }, 403);

    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const kind = body?.kind as AccountKind;

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Introduce un email válido" }, 400);
    }
    if (!ACCOUNT_KINDS.has(kind)) return jsonResponse({ error: "Tipo de cuenta no válido" }, 400);

    const password = generatePassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name || "Cuenta de pruebas" },
    });
    if (createError || !created.user) {
      if (createError?.message.toLowerCase().includes("already")) {
        return jsonResponse({ error: "Ya existe una cuenta con ese email." }, 409);
      }
      console.error("[ADMIN-CREATE-TEST-ACCOUNT] Auth create failed:", createError?.message);
      return jsonResponse({ error: "No se pudo crear la cuenta. Comprueba el email e inténtalo de nuevo." }, 500);
    }

    const userId = created.user.id;
    try {
      const clientTier = {
        client_training: "training",
        client_full: "full",
        client_transform: "transform",
      }[kind];

      if (clientTier) {
        const { error } = await admin
          .from("profiles")
          .update({
            name: name || "Cuenta de pruebas",
            payment_status: "paid",
            subscription_status: "active",
            subscription_tier: clientTier,
            plan_status: "plan_pending",
          })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const role = kind === "trainer" ? "trainer" : "admin";
        const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;

        if (kind === "trainer") {
          const { error: trainerProfileError } = await admin.from("trainer_profiles").insert({
            user_id: userId,
            display_name: name || "Entrenador de pruebas",
            visible: false,
          });
          if (trainerProfileError) throw trainerProfileError;
        }
      }

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("user_id, email, name, plan_status, payment_status, created_at, subscription_tier")
        .eq("user_id", userId)
        .single();
      if (profileError) throw profileError;

      return jsonResponse({ profile, kind, password });
    } catch (setupError) {
      console.error("[ADMIN-CREATE-TEST-ACCOUNT] Setup failed; removing partial account:", setupError);
      const { error: rollbackError } = await admin.auth.admin.deleteUser(userId);
      if (rollbackError) console.error("[ADMIN-CREATE-TEST-ACCOUNT] Rollback failed:", rollbackError.message);
      return jsonResponse({ error: "No se pudo preparar la cuenta. No se ha guardado una cuenta parcial." }, 500);
    }
  } catch (error) {
    console.error("[ADMIN-CREATE-TEST-ACCOUNT] Unexpected error:", error);
    return jsonResponse({ error: "No se pudo crear la cuenta de prueba." }, 500);
  }
});
