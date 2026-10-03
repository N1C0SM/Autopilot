import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getConsumerPlan, type ConsumerPlan } from "@/lib/entitlements";
import type { Database } from "@/integrations/supabase/types";

type Config = Database["public"]["Tables"]["product_configs"]["Row"];
type Row = { user_id: string; email: string; name: string | null; plan: ConsumerPlan; trainer: string | null };
type Trainer = { user_id: string; email: string };

export default function ProductsAdmin() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [filter, setFilter] = useState<"all" | ConsumerPlan | "pending">("pending");

  const load = async () => {
    const [{ data: c }, { data: profiles }, { data: assigns }, { data: roles }] = await Promise.all([
      supabase.from("product_configs").select("*").eq("key", "trainer_plan").maybeSingle(),
      supabase.from("profiles").select("user_id, email, name, payment_status, subscription_tier, subscription_status, subscription_end, stripe_payment_id"),
      supabase.from("trainer_assignments").select("user_id, trainer_id").eq("status", "active"),
      supabase.from("user_roles").select("user_id").eq("role", "trainer"),
    ]);
    setCfg(c);
    const emailOf = new Map((profiles || []).map((p) => [p.user_id, p.email]));
    const tOf = new Map((assigns || []).map((a) => [a.user_id, a.trainer_id]));
    setRows((profiles || []).map((p) => ({
      user_id: p.user_id, email: p.email, name: p.name, plan: getConsumerPlan(p),
      trainer: tOf.has(p.user_id) ? emailOf.get(tOf.get(p.user_id)!) || "—" : null,
    })));
    setTrainers((roles || []).map((r) => ({ user_id: r.user_id, email: emailOf.get(r.user_id) || r.user_id })));
  };
  useEffect(() => { void load(); }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [apps, setApps] = useState<any[]>([]);
  useEffect(() => {
    void supabase.from("leads").select("id, email, quiz_answers, created_at").eq("source", "trainer_application")
      .order("created_at", { ascending: false }).then(({ data }) => setApps(data || []));
  }, []);

  const save = async (patch: Partial<Config>) => {
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    const { error } = await supabase.from("product_configs").update(patch).eq("key", "trainer_plan");
    if (error) return toast.error("No se pudo guardar");
    setCfg(next);
    toast.success("Guardado");
  };

  const assign = async (userId: string, email: string, trainerId: string) => {
    const { error } = trainerId
      ? await supabase.rpc("admin_assign_user_to_trainer", { _trainer_id: trainerId, _email: email })
      : await supabase.from("trainer_assignments").delete().eq("user_id", userId);
    if (error) return toast.error("No se pudo cambiar la asignación");
    toast.success(trainerId ? "Entrenador asignado" : "Asignación retirada");
    void load();
  };

  const visible = rows.filter((r) => filter === "all" ? true : filter === "pending" ? r.plan === "coach" && !r.trainer : r.plan === filter);
  const count = (p: ConsumerPlan) => rows.filter((r) => r.plan === p).length;
  const pendingCount = rows.filter((r) => r.plan === "coach" && !r.trainer).length;

  return (
    <div className="space-y-8 max-w-4xl">
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap gap-2 text-sm">
          {([["pending", `Coach sin entrenador (${pendingCount})`], ["free", `Free (${count("free")})`], ["plus", `Plus (${count("plus")})`], ["coach", `Coach (${count("coach")})`], ["all", "Todos"]] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{l}</Button>
          ))}
        </div>
        <div className="divide-y divide-border">
          {visible.length === 0 && <p className="py-4 text-sm text-muted-foreground">No hay usuarios en este grupo.</p>}
          {visible.slice(0, 200).map((r) => (
            <div key={r.user_id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <div className="flex-1 min-w-[12rem] truncate">{r.name || r.email} <span className="text-muted-foreground">· {r.email}</span></div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground w-14">{r.plan}</span>
              {r.plan === "coach" && (
                <select className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  value={trainers.find((t) => t.email === r.trainer)?.user_id || ""}
                  onChange={(e) => void assign(r.user_id, r.email, e.target.value)}>
                  <option value="">Sin entrenador</option>
                  {trainers.map((t) => <option key={t.user_id} value={t.user_id}>{t.email}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>

      {cfg && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold">Autopilot para entrenadores</h2>
              <p className="text-sm text-muted-foreground">Estado: <span className="font-semibold text-foreground">{cfg.enabled ? "ACTIVADO" : "DESACTIVADO"}</span></p>
              {!cfg.enabled && <p className="mt-1 text-sm text-muted-foreground">El producto está construido pero actualmente no está disponible públicamente.</p>}
            </div>
            {cfg.enabled
              ? <Button variant="outline" onClick={() => void save({ enabled: false })}>Desactivar</Button>
              : <Button onClick={() => setConfirm(true)}>Activar</Button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm space-y-1">Nombre<Input defaultValue={cfg.name} onBlur={(e) => void save({ name: e.target.value })} /></label>
            <label className="text-sm space-y-1">Precio<Input type="number" defaultValue={cfg.price} onBlur={(e) => void save({ price: Number(e.target.value) })} /></label>
            <label className="text-sm space-y-1">Moneda<Input defaultValue={cfg.currency} onBlur={(e) => void save({ currency: e.target.value.toUpperCase() })} /></label>
            <label className="text-sm space-y-1">Periodicidad
              <select className="w-full rounded-md border border-border bg-background px-3 py-2" defaultValue={cfg.billing_interval} onChange={(e) => void save({ billing_interval: e.target.value })}>
                <option value="month">Mensual</option><option value="year">Anual</option>
              </select>
            </label>
            <label className="text-sm space-y-1">Máximo de clientes (interno, no se muestra)<Input type="number" defaultValue={cfg.max_clients} onBlur={(e) => void save({ max_clients: Number(e.target.value) })} /></label>
            <label className="text-sm space-y-1">Price ID Stripe (live)<Input defaultValue={cfg.stripe_price_id_live || ""} onBlur={(e) => void save({ stripe_price_id_live: e.target.value || null })} /></label>
          </div>
          <label className="text-sm space-y-1 block">Descripción<Textarea defaultValue={cfg.description} onBlur={(e) => void save({ description: e.target.value })} /></label>
          <label className="text-sm space-y-1 block">Funciones incluidas (una por línea)
            <Textarea defaultValue={(cfg.features as string[]).join("\n")} onBlur={(e) => void save({ features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
          </label>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><Switch checked={cfg.publicly_visible} onCheckedChange={(v) => void save({ publicly_visible: v })} />Visible públicamente</label>
            <label className="flex items-center gap-2"><Switch checked={cfg.accepting_new_subscriptions} onCheckedChange={(v) => void save({ accepting_new_subscriptions: v })} />Acepta nuevas altas</label>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-display text-lg font-bold">Solicitudes de entrenadores ({apps.length})</h2>
        {apps.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay solicitudes.</p>}
        <div className="divide-y divide-border">
          {apps.map((a) => (
            <div key={a.id} className="py-2 text-sm flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold">{a.quiz_answers?.name || "—"}</span>
              <a className="text-primary" href={`mailto:${a.email}`}>{a.email}</a>
              {a.quiz_answers?.phone && <span>{a.quiz_answers.phone}</span>}
              <span className="text-muted-foreground">{a.quiz_answers?.clients} clientes · {a.quiz_answers?.tools} · {a.quiz_answers?.goal}</span>
              <span className="text-xs text-muted-foreground ml-auto">{new Date(a.created_at).toLocaleDateString("es-ES")}</span>
            </div>
          ))}
        </div>
      </section>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Activar Autopilot para entrenadores?</AlertDialogTitle>
            <AlertDialogDescription>Los entrenadores con suscripción podrán invitar a sus propios clientes. Lo público depende además de «Visible públicamente».</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save({ enabled: true })}>Activar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
