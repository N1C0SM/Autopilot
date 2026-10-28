import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { toast } from "sonner";
import CertificateLink from "@/web/components/CertificateLink";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { hapticTap } from "@/shared/lib/native";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { Award, Trash2 } from "lucide-react";
import type { Database } from "@/shared/integrations/supabase/types";

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
  const { ask, dialog: confirmDialog } = useConfirm();

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
    if (!(await ask({ title: `¿Retirar «${certificate.title}»?`, description: "Dejará de mostrarse en la landing y se eliminará el archivo.", confirmLabel: "Retirar" }))) return;
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

  return <section className="space-y-4 pt-6" aria-labelledby="certificates-heading">
    <div className="space-y-1">
      <h3 id="certificates-heading" className="type-title3">Certificados del entrenador</h3>
      <p className="type-subhead text-muted-foreground">Los documentos se podrán consultar en la landing si este perfil está visible. Sube una copia autorizada sin DNI, dirección ni otros datos privados. Subir un documento no implica una verificación independiente.</p>
    </div>
    {loading ? (
      <div role="status" className="flex items-center justify-center gap-2 py-6 type-subhead text-muted-foreground"><Spinner size="sm" label="Cargando certificados" /> Cargando certificados…</div>
    ) : failed ? (
      <div role="alert" className="flex items-center justify-between gap-3">
        <p className="type-footnote text-destructive">No se pudieron cargar los certificados.</p>
        <Button variant="plain" className="-mr-4 shrink-0" onClick={() => { void hapticTap(); void load(); }}>Reintentar</Button>
      </div>
    ) : certificates.length === 0 ? (
      <EmptyState icon={Award} title="Sin certificados publicados" description="La landing mostrará “Entrenador del equipo” y su presentación." className="py-6" />
    ) : (
      <ListGroup>
        {certificates.map(c => (
          <ListRow
            key={c.id}
            title={<span className="break-words">{c.title}</span>}
            subtitle={<span className="break-words">{c.issuer}</span>}
            trailing={
              <span className="-mr-2 flex items-center">
                <CertificateLink path={c.file_path} title={c.title} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive [&_svg]:size-[18px]"
                  aria-label={`Eliminar certificado: ${c.title}`}
                  disabled={busy}
                  onClick={() => { void hapticTap(); void remove(c); }}
                >
                  <Trash2 />
                </Button>
              </span>
            }
          />
        ))}
      </ListGroup>
    )}
    <fieldset disabled={busy || loading || failed} className="space-y-4">
      <div><Label htmlFor="certificate-title" className="mb-1.5 block text-muted-foreground">Nombre de la titulación</Label><Input id="certificate-title" maxLength={160} autoCapitalize="sentences" enterKeyHint="next" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre exacto que aparece en el certificado" /></div>
      <div><Label htmlFor="certificate-issuer" className="mb-1.5 block text-muted-foreground">Entidad que lo expide</Label><Input id="certificate-issuer" maxLength={160} autoCapitalize="sentences" enterKeyHint="done" value={issuer} onChange={e => setIssuer(e.target.value)} /></div>
      <div><Label htmlFor="certificate-file" className="mb-1.5 block text-muted-foreground">Documento · PDF, JPG, PNG o WebP · máximo 10 MB</Label><Input ref={input} id="certificate-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
      <Button type="button" variant="tinted" className="w-full md:w-auto" onClick={() => { void hapticTap(); void upload(); }} disabled={!file || !title.trim() || !issuer.trim()}>{busy ? "Guardando…" : "Subir y publicar certificado"}</Button>
    </fieldset>
    {confirmDialog}
  </section>;
}
