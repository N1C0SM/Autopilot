import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Inbox, Users } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { SectionHeader } from "@/shared/components/ui/section-header";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { toast } from "sonner";
import { hapticSelection } from "@/shared/lib/native";
import { getConsumerPlan, type ConsumerPlan } from "@/shared/lib/entitlements";
import type { Database } from "@/shared/integrations/supabase/types";
import ConsumerPlansAdmin from "@/app/components/admin/ConsumerPlansAdmin";
import { ChipBar, Field, FieldRow, MONO_FIELD } from "@/app/components/admin/AdminOpsParts";

type Config = Database["public"]["Tables"]["product_configs"]["Row"];
type Row = { user_id: string; email: string; name: string | null; plan: ConsumerPlan; trainer: string | null };
type Trainer = { user_id: string; email: string };
type PlanFilter = "all" | ConsumerPlan | "pending";

export default function ProductsAdmin() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [filter, setFilter] = useState<PlanFilter>("pending");

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

  const filters: Array<{ value: PlanFilter; label: string }> = [
    { value: "pending", label: `Coach sin entrenador (${pendingCount})` },
    { value: "free", label: `Free (${count("free")})` },
    { value: "plus", label: `Plus (${count("plus")})` },
    { value: "coach", label: `Coach (${count("coach")})` },
    { value: "all", label: "Todos" },
  ];

  return (
    <div className="space-y-8">
      <ConsumerPlansAdmin />

      <section className="space-y-3">
        <SectionHeader title="Usuarios por plan" />
        <ChipBar<PlanFilter> options={filters} value={filter} onChange={setFilter} aria-label="Filtrar por plan" />
        {visible.length === 0 ? (
          <EmptyState icon={Users} title="No hay usuarios en este grupo" />
        ) : (
          <ListGroup>
            {visible.slice(0, 200).map((r) => (
              <ListRow
                key={r.user_id}
                title={r.name || r.email}
                subtitle={
                  r.name || r.plan === "coach" ? (
                    <>
                      {r.name ? <span className="block truncate">{r.email}</span> : null}
                      {r.plan === "coach" ? (
                        <select
                          aria-label={`Entrenador de ${r.name || r.email}`}
                          className="field mt-2 w-full max-w-xs text-foreground"
                          value={trainers.find((t) => t.email === r.trainer)?.user_id || ""}
                          onChange={(e) => void assign(r.user_id, r.email, e.target.value)}
                        >
                          <option value="">Sin entrenador</option>
                          {trainers.map((t) => <option key={t.user_id} value={t.user_id}>{t.email}</option>)}
                        </select>
                      ) : null}
                    </>
                  ) : undefined
                }
                value={<span className="type-subhead capitalize">{r.plan}</span>}
              />
            ))}
          </ListGroup>
        )}
      </section>

      {cfg && (
        <section className="space-y-4">
          <SectionHeader title="Autopilot para entrenadores" />
          <div className="space-y-6">
            <ListGroup footer={cfg.enabled ? undefined : "El producto está construido pero actualmente no está disponible públicamente."}>
              <ListRow
                title="Producto activado"
                trailing={
                  <Switch
                    aria-label="Producto activado"
                    checked={cfg.enabled}
                    onCheckedChange={(v) => { void hapticSelection(); if (v) setConfirm(true); else void save({ enabled: false }); }}
                  />
                }
              />
            </ListGroup>

            <ListGroup>
              <FieldRow label="Nombre" htmlFor="trainer-plan-name">
                <Input id="trainer-plan-name" enterKeyHint="next" defaultValue={cfg.name} onBlur={(e) => void save({ name: e.target.value })} />
              </FieldRow>
              <FieldRow columns>
                <Field label="Precio" htmlFor="trainer-plan-price">
                  <Input id="trainer-plan-price" type="number" inputMode="decimal" enterKeyHint="next" defaultValue={cfg.price} onBlur={(e) => void save({ price: Number(e.target.value) })} />
                </Field>
                <Field label="Moneda" htmlFor="trainer-plan-currency">
                  <Input id="trainer-plan-currency" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="next" defaultValue={cfg.currency} onBlur={(e) => void save({ currency: e.target.value.toUpperCase() })} />
                </Field>
              </FieldRow>
              <FieldRow label="Periodicidad" htmlFor="trainer-plan-interval">
                <select id="trainer-plan-interval" className="field w-full text-foreground" defaultValue={cfg.billing_interval} onChange={(e) => void save({ billing_interval: e.target.value })}>
                  <option value="month">Mensual</option><option value="year">Anual</option>
                </select>
              </FieldRow>
              <FieldRow label="Máximo de clientes (interno, no se muestra)" htmlFor="trainer-plan-max">
                <Input id="trainer-plan-max" type="number" inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" defaultValue={cfg.max_clients} onBlur={(e) => void save({ max_clients: Number(e.target.value) })} />
              </FieldRow>
              <FieldRow label="Enlace de pago Stripe (Payment Link)" htmlFor="trainer-plan-link">
                <Input
                  id="trainer-plan-link" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next"
                  className={MONO_FIELD} placeholder="https://buy.stripe.com/..." defaultValue={cfg.stripe_price_id_live || ""}
                  onBlur={(e) => void save({ stripe_price_id_live: e.target.value || null })}
                />
              </FieldRow>
              <FieldRow label="Descripción" htmlFor="trainer-plan-description">
                <Textarea id="trainer-plan-description" defaultValue={cfg.description} onBlur={(e) => void save({ description: e.target.value })} />
              </FieldRow>
              <FieldRow label="Funciones incluidas (una por línea)" htmlFor="trainer-plan-features">
                <Textarea id="trainer-plan-features" defaultValue={(cfg.features as string[]).join("\n")} onBlur={(e) => void save({ features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </FieldRow>
            </ListGroup>

            <ListGroup>
              <ListRow
                title="Visible públicamente"
                trailing={<Switch aria-label="Visible públicamente" checked={cfg.publicly_visible} onCheckedChange={(v) => { void hapticSelection(); void save({ publicly_visible: v }); }} />}
              />
              <ListRow
                title="Acepta nuevas altas"
                trailing={<Switch aria-label="Acepta nuevas altas" checked={cfg.accepting_new_subscriptions} onCheckedChange={(v) => { void hapticSelection(); void save({ accepting_new_subscriptions: v }); }} />}
              />
            </ListGroup>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader title={`Solicitudes de entrenadores (${apps.length})`} />
        {apps.length === 0 ? (
          <EmptyState icon={Inbox} title="Aún no hay solicitudes" />
        ) : (
          <ListGroup>
            {apps.map((a) => (
              <ListRow
                key={a.id}
                title={a.quiz_answers?.name || "—"}
                subtitle={
                  <>
                    <span className="block truncate">
                      <a href={`mailto:${a.email}`} className="text-primary active:opacity-60">{a.email}</a>
                      {a.quiz_answers?.phone ? ` · ${a.quiz_answers.phone}` : ""}
                    </span>
                    <span className="block">{a.quiz_answers?.clients} clientes · {a.quiz_answers?.tools} · {a.quiz_answers?.goal}</span>
                  </>
                }
                value={<span className="type-footnote">{new Date(a.created_at).toLocaleDateString("es-ES")}</span>}
              />
            ))}
          </ListGroup>
        )}
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
