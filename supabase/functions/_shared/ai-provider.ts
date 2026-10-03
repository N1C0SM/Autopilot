// Proveedor de IA compartido: Lovable AI o la clave de OpenAI que el admin guarda en Ajustes.
// Modo (app_secrets.AI_PROVIDER): "auto" (tu clave primero, si falla Lovable), "openai" o "lovable".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const LOVABLE = "https://ai.gateway.lovable.dev";
const OPENAI = "https://api.openai.com";
const FALLBACK_STATUS = new Set([401, 402, 403, 429]);

export type AiMode = "auto" | "openai" | "lovable";

export async function getAiConfig() {
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await svc.from("app_secrets").select("key, value").in("key", ["OPENAI_API_KEY", "AI_PROVIDER"]);
  const get = (k: string) => (data || []).find((r: any) => r.key === k)?.value?.trim() || "";
  const openaiKey = get("OPENAI_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "";
  const raw = get("AI_PROVIDER");
  const mode: AiMode = raw === "openai" || raw === "lovable" ? raw : "auto";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
  const order: ("openai" | "lovable")[] =
    mode === "lovable" ? ["lovable"] : mode === "openai" ? (openaiKey ? ["openai"] : ["lovable"]) : openaiKey ? ["openai", "lovable"] : ["lovable"];
  return { mode, openaiKey, lovableKey, order };
}

function toOpenAiModel(model: string, path: string): string | null {
  if (path.includes("/images/")) return "gpt-image-1";
  if (/image/.test(model)) return null; // generación de imagen por chat: solo Lovable
  if (/pro|gpt-6|gpt-5/.test(model)) return "gpt-4.1";
  return "gpt-4.1-mini";
}

/** Igual que fetch() hacia el gateway de Lovable, pero usa el proveedor configurado y cae al otro si no hay saldo. */
export async function aiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const cfg = await getAiConfig();
  const path = url.replace(LOVABLE, "");
  const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
  let last: Response | null = null;
  for (let i = 0; i < cfg.order.length; i++) {
    const p = cfg.order[i];
    const headers = new Headers(init.headers);
    let reqBody = init.body;
    let target = url;
    if (p === "openai") {
      const m = body ? toOpenAiModel(String(body.model || ""), path) : "gpt-4.1-mini";
      if (!m) continue;
      const b = { ...body, model: m };
      delete b.reasoning_effort; delete b.reasoning; delete b.include; delete b.modalities;
      if (path.includes("/images/")) delete b.response_format;
      reqBody = JSON.stringify(b);
      target = OPENAI + path;
      headers.set("Authorization", `Bearer ${cfg.openaiKey}`);
      headers.delete("X-Lovable-AIG-SDK");
    } else {
      headers.set("Authorization", `Bearer ${cfg.lovableKey}`);
    }
    const r = await fetch(target, { ...init, headers, body: reqBody });
    if (r.ok || i === cfg.order.length - 1 || !FALLBACK_STATUS.has(r.status)) return r;
    console.warn(`AI provider ${p} failed [${r.status}], trying next`);
    last = r;
  }
  return last ?? fetch(url, init);
}
