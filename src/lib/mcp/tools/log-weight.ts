import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "log_weight",
  title: "Registrar peso",
  description: "Guarda un nuevo registro de peso corporal (en kilogramos) para el usuario autenticado.",
  inputSchema: {
    weight_kg: z.number().describe("Peso corporal en kilogramos (por ejemplo 78.5)."),
    note: z.string().describe("Nota opcional sobre el registro.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  needsApproval: true,
  handler: async ({ weight_kg, note }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    if (!Number.isFinite(weight_kg) || weight_kg <= 20 || weight_kg > 400) {
      return { content: [{ type: "text", text: "Peso fuera de rango (20-400 kg)" }], isError: true };
    }
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("weight_logs")
      .insert({ user_id: ctx.getUserId(), weight_kg, note: note ?? null })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Peso registrado: ${weight_kg} kg` }],
      structuredContent: { weight_log: data },
    };
  },
});