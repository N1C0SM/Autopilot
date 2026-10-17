import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

interface RoadmapData {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  version?: string;
  description: string;
  created_at?: string;
}

const ROADMAP_URL = "https://roadmap-wizardry-76.lovable.app";

export default function RoadmapAdmin() {
  const [loading, setLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  // Reload iframe on mount to ensure fresh data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIframeKey(prev => prev + 1);
      setLoading(false);
    }, 500);
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
            Tu roadmap de desarrollo en Lovable - actualizado automáticamente
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center rounded-2xl bg-secondary">
          <Spinner size="lg" label="Cargando roadmap..." />
        </div>
      ) : (
        <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border bg-card shadow-sm">
          <iframe
            key={iframeKey}
            src={`${ROADMAP_URL}?embed=true`}
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
