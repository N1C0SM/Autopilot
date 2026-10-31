import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { functionErrorMessage } from "@/shared/lib/runtimeValues";
import { hapticTap } from "@/shared/lib/native";

/** Respuesta de `exercise-import` (los recuentos van siempre; el resto según la acción). */
type Counts = { draft: number; pending: number; published: number; draftCredits: number };
type Preview = Counts & { total: number; variants: number; alreadyImported: number; nameTaken: number; toImport: number };

const CATALOG_IMPORT_COPY = {
  title: "Catálogo base",
  body: "Ejercicios con datos abiertos (licencia MIT), sin imágenes de terceros. Entran como borrador, la IA los reescribe con la voz de Autopilot y los publicas tú. El planificador no los usa hasta que los marques como aptos.",
  preview: "Revisar importación",
  draft: "Redactar con IA",
  publish: "Publicar redactados",
} as const;

const call = async <T,>(body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke<T>("exercise-import", { body });
  if (error) throw new Error(await functionErrorMessage(error, "No se pudo completar"));
  return data as T;
};

/** Admin → Biblioteca: importar el catálogo base, redactarlo con IA y publicarlo. */
export default function CatalogImport({ onChanged }: { onChanged: () => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<{ done: number; total: number } | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const cancel = useRef(false);

  useEffect(() => { call<Counts>({ action: "status" }).then(setCounts).catch(() => setCounts(null)); }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    void hapticTap();
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo completar"); } finally { setBusy(null); }
  };

  const review = () => run("preview", async () => setPreview(await call<Preview>({ action: "preview" })));

  const importAll = () => run("import", async () => {
    const r = await call<Preview & { imported: number }>({ action: "import" });
    setCounts(r); setPreview(null); onChanged();
    toast.success(`${r.imported} ejercicios importados como borrador`);
  });

  const draftAll = () => run("draft", async () => {
    cancel.current = false;
    const total = counts?.draft ?? 0;
    let current = counts;
    setDrafting({ done: 0, total });
    try {
      while (current && current.draft > 0 && !cancel.current) {
        const before = current.draft;
        current = await call<Counts>({ action: "draft", limit: 25 });
        setCounts(current);
        setDrafting({ done: total - current.draft, total });
        // Si una tanda no avanza, los que quedan fallan siempre: no se repite en bucle.
        if (current.draft >= before) { toast.error(`${current.draft} borradores no se pudieron redactar`); break; }
      }
    } finally {
      setDrafting(null); onChanged();
    }
  });

  const publish = () => run("publish", async () => {
    const r = await call<Counts & { published: number }>({ action: "publish" });
    setCounts(r); setConfirmPublish(false); onChanged();
    toast.success("Ejercicios publicados");
  });

  return (
    <section aria-labelledby="catalog-import-title" className="space-y-3 rounded-[22px] bg-card p-5">
      <h2 id="catalog-import-title" className="type-headline">{CATALOG_IMPORT_COPY.title}</h2>
      <p className="type-footnote text-muted-foreground">{CATALOG_IMPORT_COPY.body}</p>
      {counts && (
        <p className="type-footnote" role="status">
          Borrador {counts.draft} · Pendientes de revisar {counts.pending} · Publicados {counts.published}
        </p>
      )}

      {preview && (
        <p className="type-footnote text-muted-foreground" role="status">
          {preview.toImport} nuevos de {preview.total} · {preview.variants} variantes repetidas · {preview.alreadyImported + preview.nameTaken} ya están en tu biblioteca
        </p>
      )}

      {drafting && (
        <div className="space-y-2">
          <p className="type-footnote text-muted-foreground" role="status">Redactando {drafting.done} de {drafting.total}</p>
          <Progress value={(drafting.done / Math.max(drafting.total, 1)) * 100} aria-label="Progreso de la redacción" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {preview && preview.toImport > 0 ? (
          <Button type="button" size="sm" disabled={!!busy} onClick={importAll}>
            Importar {preview.toImport} como borrador
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" disabled={!!busy} onClick={review}>
            {busy === "preview" ? "Revisando…" : CATALOG_IMPORT_COPY.preview}
          </Button>
        )}
        {drafting ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => { void hapticTap(); cancel.current = true; }}>Parar</Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" disabled={!!busy || !counts?.draft} onClick={draftAll}>
            {CATALOG_IMPORT_COPY.draft} ({counts?.draft ?? 0}) · ≈{counts?.draftCredits ?? 0} créditos
          </Button>
        )}
        {confirmPublish ? (
          <Button type="button" size="sm" disabled={!!busy} onClick={publish}>Confirmar: publicar {counts?.pending ?? 0}</Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" disabled={!!busy || !counts?.pending} onClick={() => { void hapticTap(); setConfirmPublish(true); }}>
            {CATALOG_IMPORT_COPY.publish} ({counts?.pending ?? 0})
          </Button>
        )}
      </div>
    </section>
  );
}
