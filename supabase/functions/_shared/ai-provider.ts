// Proveedor de IA compartido: Lovable AI, OpenAI, Claude o DeepSeek.
// Modo (app_secrets.AI_PROVIDER): "auto" (tus claves primero, Lovable como último recurso) o "lovable".
// DeepSeek es SOLO texto: no genera imágenes ni vídeos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const LOVABLE = "https://ai.gateway.lovable.dev";
const OPENAI = "https://api.openai.com";
const DEEPSEEK = "https://api.deepseek.com";
const FALLBACK_STATUS = new Set([400, 401, 402, 403, 404, 429, 500, 502, 503]);

export type AiMode = "auto" | "lovable" | "deepseek";

export async function getAiConfig() {
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await svc.from("app_secrets").select("key, value").in("key", ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY", "AI_PROVIDER"]);
  const get = (k: string) => (data || []).find((r: any) => r.key === k)?.value?.trim() || "";
  const openaiKey = get("OPENAI_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "";
  const anthropicKey = get("ANTHROPIC_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY") || "";
  const deepseekKey = get("DEEPSEEK_API_KEY") || Deno.env.get("DEEPSEEK_API_KEY") || "";
  const rawMode = get("AI_PROVIDER");
  const mode: AiMode = rawMode === "lovable" ? "lovable" : rawMode === "deepseek" ? "deepseek" : "auto";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";

  const openai = openaiKey ? (["openai"] as const) : [];
  const anthropic = anthropicKey ? (["anthropic"] as const) : [];
  const deepseek = deepseekKey ? (["deepseek"] as const) : [];

  // Cadena de proveedores:
  //  - "auto"     -> OpenAI -> Claude -> DeepSeek -> Lovable
  //  - "deepseek" -> DeepSeek primero para el TEXTO; las imágenes y los vídeos
  //                  se saltan DeepSeek (no puede generarlos) y siguen por
  //                  OpenAI -> Lovable.
  //  - "lovable"  -> solo Lovable.
  const order: ("openai" | "anthropic" | "deepseek" | "lovable")[] =
    mode === "lovable" ? ["lovable"]
      : mode === "deepseek" ? [...deepseek, ...openai, ...anthropic, "lovable"]
        : [...openai, ...anthropic, ...deepseek, "lovable"];

  return { mode, openaiKey, anthropicKey, deepseekKey, lovableKey, order };
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
    } else if (p === "anthropic") {
      // Claude solo para texto vía su endpoint compatible con chat/completions.
      if (!path.includes("/chat/completions") || !body || /image/.test(String(body.model || ""))) continue;
      const b = { ...body, model: /pro|gpt-6|gpt-5/.test(String(body.model)) ? "claude-sonnet-4-5" : "claude-haiku-4-5" };
      delete b.reasoning_effort; delete b.reasoning; delete b.include; delete b.modalities; delete b.response_format;
      if (!b.max_tokens && !b.max_completion_tokens) b.max_tokens = 8000;
      reqBody = JSON.stringify(b);
      target = "https://api.anthropic.com" + path;
      headers.set("Authorization", `Bearer ${cfg.anthropicKey}`);
      headers.set("x-api-key", cfg.anthropicKey);
      headers.set("anthropic-version", "2023-06-01");
      headers.delete("X-Lovable-AIG-SDK");
    } else if (p === "deepseek") {
      // DeepSeek es OpenAI-compatible, pero SOLO texto: nunca imágenes ni vídeos.
      if (!path.includes("/chat/completions") || !body || /image|video/.test(String(body.model || ""))) continue;
      const b = { ...body, model: "deepseek-chat" };
      delete b.reasoning_effort; delete b.reasoning; delete b.include; delete b.modalities; delete b.response_format;
      reqBody = JSON.stringify(b);
      target = DEEPSEEK + path;
      headers.set("Authorization", `Bearer ${cfg.deepseekKey}`);
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
