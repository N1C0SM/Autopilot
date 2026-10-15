import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hapticTap } from "@/lib/native";
import { toast } from "sonner";

export default function CertificateLink({ path, title }: { path: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    void hapticTap();
    // Open synchronously so browsers do not block the document after the request.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("certificate-link", { body: { path } });
      if (error || !data?.signedUrl) throw error ?? new Error("sin enlace");
      if (tab) tab.location.href = data.signedUrl;
      else window.location.assign(data.signedUrl);
    } catch {
      tab?.close();
      toast.error("No se pudo abrir el certificado. Inténtalo de nuevo.");
    } finally { setBusy(false); }
  };
  return <button type="button" disabled={busy} onClick={open} className="type-subhead inline-flex min-h-[44px] items-center text-primary transition-opacity active:opacity-60 disabled:opacity-50" aria-label={`Ver certificado: ${title}`}>{busy ? "Abriendo…" : "Ver certificado"}</button>;
}
