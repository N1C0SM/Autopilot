import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { trackingDb } from "@/lib/tracking/store";
import { stats, type Session } from "@/lib/tracking/model";
export default function TrainerReviewQueue({
  clients,
  onOpen,
}: {
  clients: Array<{ user_id: string; name?: string | null; email: string }>;
  onOpen: (id: string) => void;
}) {
  const [rows, setRows] = useState<Session[]>([]),
    [error, setError] = useState(false),
    [reload, setReload] = useState(0);
  const ids = clients
    .map((c) => c.user_id)
    .sort()
    .join(",");
  useEffect(() => {
    let active = true;
    if (!ids) {
      setRows([]);
      return;
    }
    Promise.all([
      trackingDb
        .from("workout_sessions")
        .select("*")
        .in("user_id", ids.split(","))
        .eq("status", "completed")
        .order("local_date", { ascending: false })
        .limit(500),
      trackingDb
        .from("session_adjustments")
        .select("*")
        .in("user_id", ids.split(",")),
    ]).then(([sessions, audits]) => {
      if (!active) return;
      if (sessions.error || audits.error) {
        setError(true);
        return;
      }
      const reviewed = new Set(
        (audits.data || [])
          .filter((a) => a.actor_id !== a.user_id)
          .map((a) => a.session_id),
      );
      setRows(
        (sessions.data || []).filter(
          (s) => stats(s).performed && !reviewed.has(s.id),
        ),
      );
      setError(false);
    });
    return () => {
      active = false;
    };
  }, [ids, reload]);
  return (
    <section className="rounded-2xl border bg-card p-4 space-y-2">
      <h2 className="font-bold">Pendientes de revisión</h2><Button variant="ghost" onClick={()=>setReload(n=>n+1)}>Actualizar revisiones</Button>
      <p className="text-xs text-muted-foreground">
        Sesiones finalizadas sin revisión del equipo. Se muestran las 500 más
        recientes. Abre el cliente para consultar series, esfuerzo y consumo
        registrado; guarda el motivo de la revisión.
      </p>
      {error ? (
        <Button onClick={() => setReload((n) => n + 1)}>
          Reintentar cargar revisiones
        </Button>
      ) : rows.length ? (
        rows.map((s) => (
          <Button
            className="w-full h-auto min-h-12 justify-start text-left whitespace-normal"
            variant="outline"
            key={s.id}
            onClick={() => onOpen(s.user_id)}
          >
            {clients.find((c) => c.user_id === s.user_id)?.name ||
              clients.find((c) => c.user_id === s.user_id)?.email}{" "}
            · {s.local_date} · {stats(s).done} series ·{" "}
            {stats(s).compliance ?? "—"} % del plan
          </Button>
        ))
      ) : (
        <p className="text-sm">No hay sesiones pendientes en este periodo.</p>
      )}
    </section>
  );
}
