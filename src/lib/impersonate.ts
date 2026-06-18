import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function impersonateUser(targetUserId: string, redirectTo: string = "/dashboard") {
  // Abrimos la pestaña SINCRÓNICAMENTE dentro del click para que el navegador
  // no la bloquee como popup. Luego navegamos esa pestaña al callback.
  const win = window.open("about:blank", "_blank");
  const t = toast.loading("Generando sesión de impersonación...");
  try {
    const { data, error } = await supabase.functions.invoke("admin-impersonate", {
      body: { user_id: targetUserId },
    });
    if (error) throw error;
    if (!data?.token_hash || !data?.email) throw new Error("Respuesta inválida");

    const url = `/impersonate/callback?th=${encodeURIComponent(data.token_hash)}&e=${encodeURIComponent(data.email)}&to=${encodeURIComponent(redirectTo)}`;
    toast.dismiss(t);
    if (win && !win.closed) {
      win.location.href = url;
      toast.success(`Abriendo sesión como ${data.email}`);
    } else {
      // Popup bloqueado: usamos la misma pestaña como fallback.
      toast.message("Tu navegador bloqueó la pestaña nueva. Abriendo aquí…");
      window.location.href = url;
    }
  } catch (e: any) {
    if (win && !win.closed) win.close();
    toast.dismiss(t);
    toast.error(e?.message || "No se pudo impersonar");
  }
}