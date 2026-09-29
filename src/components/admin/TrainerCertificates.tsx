import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import CertificateLink from "@/components/CertificateLink";
import type { Database } from "@/integrations/supabase/types";

type Certificate = Database["public"]["Tables"]["trainer_certificates"]["Row"];
const certificateExtensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export default function TrainerCertificates({ profileId }: { profileId: string }) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("trainer_certificates").select("*").eq("trainer_profile_id", profileId).order("created_at");
    setFailed(Boolean(error));
    if (data) setCertificates(data);
    setLoading(false);
  }, [profileId]);
  useEffect(() => { void load(); }, [load]);

  const upload = async () => {
    if (!file || !title.trim() || !issuer.trim()) return;
    if (!certificateExtensions[file.type] || file.size === 0 || file.size > 10 * 1024 * 1024) {
      toast.error("Elige un PDF, JPG, PNG o WebP de hasta 10 MB."); return;
    }
    setBusy(true);
    const path = `${profileId}/${crypto.randomUUID()}.${certificateExtensions[file.type]}`;
    try {
      const { error: uploadError } = await supabase.storage.from("trainer-certificates").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("trainer_certificates").insert({ trainer_profile_id: profileId, title: title.trim(), issuer: issuer.trim(), file_path: path });
      if (error) {
        await supabase.storage.from("trainer-certificates").remove([path]);
        throw error;
      }
      setTitle(""); setIssuer(""); setFile(null);
      if (input.current) input.current.value = "";
      toast.success("Certificado guardado. Se mostrará cuando el perfil esté visible.");
      await load();
    } catch { toast.error("No se pudo guardar el certificado. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  };

  const remove = async (certificate: Certificate) => {
    if (!window.confirm(`¿Retirar «${certificate.title}» de la landing y eliminar el archivo?`)) return;
    setBusy(true);
    try {
      // Removing the row first revokes access even if storage cleanup fails.
      const { error } = await supabase.from("trainer_certificates").delete().eq("id", certificate.id);
      if (error) throw error;
      setCertificates(current => current.filter(c => c.id !== certificate.id));
      const { error: cleanupError } = await supabase.storage.from("trainer-certificates").remove([certificate.file_path]);
      if (cleanupError) toast.warning("Certificado retirado. No se pudo limpiar el archivo del almacenamiento.");
      else toast.success("Certificado eliminado");
    } catch { toast.error("No se pudo retirar el certificado."); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4 border-t border-border pt-6" aria-labelledby="certificates-heading">
    <h3 id="certificates-heading" className="font-display font-semibold">Certificados del entrenador</h3>
    <p className="text-sm text-muted-foreground">Los documentos se podrán consultar en la landing si este perfil está visible. Sube una copia autorizada sin DNI, dirección ni otros datos privados. Subir un documento no implica una verificación independiente.</p>
    {loading ? <p role="status">Cargando certificados…</p> : failed ? <div role="alert"><p>No se pudieron cargar los certificados.</p><Button variant="outline" onClick={load}>Reintentar</Button></div> : certificates.length === 0 ? <p className="text-sm text-muted-foreground">Sin certificados publicados. La landing mostrará “Entrenador del equipo” y su presentación.</p> : <ul className="divide-y divide-border">
      {certificates.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-medium break-words">{c.title}</p><p className="text-sm text-muted-foreground break-words">{c.issuer}</p><CertificateLink path={c.file_path} title={c.title} /></div><Button type="button" variant="outline" disabled={busy} onClick={() => remove(c)}>Eliminar certificado</Button></li>)}
    </ul>}
    <fieldset disabled={busy || loading || failed} className="space-y-3">
      <div><Label htmlFor="certificate-title">Nombre de la titulación</Label><Input id="certificate-title" maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre exacto que aparece en el certificado" /></div>
      <div><Label htmlFor="certificate-issuer">Entidad que lo expide</Label><Input id="certificate-issuer" maxLength={160} value={issuer} onChange={e => setIssuer(e.target.value)} /></div>
      <div><Label htmlFor="certificate-file">Documento · PDF, JPG, PNG o WebP · máximo 10 MB</Label><Input ref={input} id="certificate-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
      <Button type="button" onClick={upload} disabled={!file || !title.trim() || !issuer.trim()}>{busy ? "Guardando…" : "Subir y publicar certificado"}</Button>
    </fieldset>
  </section>;
}
