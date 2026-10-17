import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

const ROADMAP_URL = "https://roadmap-wizardry-76.lovable.app";

export default function RoadmapAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to load the roadmap
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000); // Give it 2 seconds to load
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Info className="h-5 w-5" />
        </div>
        <div>
          <h2 className="type-title2">Roadmap</h2>
          <p className="type-subhead text-muted-foreground">
            Tu roadmap de desarrollo en Lovable
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive">
          <p>No se pudo cargar el roadmap externo.</p>
          <p className="text-sm mt-1">Puedes verlo directamente en: <a href={ROADMAP_URL} target="_blank" rel="noopener noreferrer" className="underline">roadmap-wizardry-76.lovable.app</a></p>
        </div>
      ) : (
        <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border bg-card shadow-sm relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
              <Spinner size="lg" label="Cargando roadmap..." />
            </div>
          )}
          <iframe
            src={ROADMAP_URL}
            className="h-full w-full border-0"
            title="Roadmap"
            allow="fullscreen"
          />
        </div>
      )}

      <div className="rounded-xl bg-primary/5 p-4 text-sm text-primary/80">
        <strong>¿Cómo funciona?</strong> Este roadmap se sincroniza automáticamente con Lovable. 
        Cuando actualices tu roadmap allí, se refrescará aquí automáticamente.
      </div>
    </div>
  );
}
