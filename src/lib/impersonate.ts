import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function impersonateUser(targetUserId: string, redirectTo: string = "/dashboard") {
  const t = toast.loading("Generando sesión de impersonación...");
  try {
    const { data, error } = await supabase.functions.invoke("admin-impersonate", {
      body: { user_id: targetUserId },
    });
    if (error) throw error;
    if (!data?.token_hash || !data?.email) throw new Error("Respuesta inválida");

    const url = `/impersonate/callback?th=${encodeURIComponent(data.token_hash)}&e=${encodeURIComponent(data.email)}&to=${encodeURIComponent(redirectTo)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.dismiss(t);
    toast.success(`Abriendo sesión como ${data.email}`);
  } catch (e: any) {
    toast.dismiss(t);
    toast.error(e?.message || "No se pudo impersonar");
  }
}