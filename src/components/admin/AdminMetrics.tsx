import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Users, CreditCard, Camera, Mail, TrendingUp, Target, CheckCircle2, AlertCircle, Activity, Dumbbell, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid } from "recharts";

interface Stat {
  label: string;
  value: number | string;
  hint?: string;
  icon: any;
  accent?: boolean;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"];

const GOAL_LABELS: Record<string, string> = {
  lose_fat: "Perder grasa",
  gain_muscle: "Ganar músculo",
  recomp: "Recomposición",
  posture: "Mejorar postura",
  start: "Empezar de cero",
};

const TIER_LABELS: Record<string, string> = {
  training: "Entrenamiento",
  full: "Completo",
  transform: "Transformación",
  none: "Sin plan",
};

const AdminMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
      setLoading(true);
      const now = new Date();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d1 = new Date(now.getTime() - 1 * 86400000).toISOString();

      const [
        { data: profiles },
        { data: scans },
        { data: leads },
        { data: emails },
        { data: completions },
        { data: chats },
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, email, created_at, payment_status, plan_status, subscription_tier"),
        supabase.from("scan_leads").select("id, goal, email, created_at, user_id"),
        supabase.from("leads").select("id, source, created_at"),
        supabase.from("email_send_log").select("template_name, status, created_at, message_id").gte("created_at", d30),
        supabase.from("day_completions").select("user_id, completed_at").gte("completed_at", d30.slice(0, 10)),
        supabase.from("chat_messages").select("id, created_at").gte("created_at", d7),
      ]);

      const profs = profiles || [];
      const scn = scans || [];
      const lds = leads || [];

      // Dedupe emails by message_id (latest status)
      const emailMap = new Map<string, any>();
      (emails || []).forEach((e: any) => {
        if (!e.message_id) return;
        const prev = emailMap.get(e.message_id);
        if (!prev || new Date(e.created_at) > new Date(prev.created_at)) emailMap.set(e.message_id, e);
      });
      const dedupedEmails = Array.from(emailMap.values());

      // Funnel
      const totalScans = scn.length;
      const scansWithEmail = scn.filter((s) => s.email).length;
      const totalProfiles = profs.length;
      const paid = profs.filter((p) => p.payment_status === "paid").length;
      const planReady = profs.filter((p) => p.plan_status === "plan_ready").length;

      // Scan goals breakdown
      const goalCounts: Record<string, number> = {};
      scn.forEach((s) => {
        const g = s.goal || "unknown";
        goalCounts[g] = (goalCounts[g] || 0) + 1;
      });
      const goalsData = Object.entries(goalCounts).map(([k, v]) => ({ name: GOAL_LABELS[k] || k, value: v }));

      // Tier breakdown (paid only)
      const tierCounts: Record<string, number> = {};
      profs.filter((p) => p.payment_status === "paid").forEach((p) => {
        const t = p.subscription_tier || "none";
        tierCounts[t] = (tierCounts[t] || 0) + 1;
      });
      const tiersData = Object.entries(tierCounts).map(([k, v]) => ({ name: TIER_LABELS[k] || k, value: v }));

      // Daily signups last 30 days
      const daysMap: Record<string, { date: string; signups: number; scans: number; paid: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        daysMap[key] = { date: key.slice(5), signups: 0, scans: 0, paid: 0 };
      }
      profs.forEach((p) => {
        const key = (p.created_at || "").slice(0, 10);
        if (daysMap[key]) daysMap[key].signups++;
      });
      scn.forEach((s) => {
        const key = (s.created_at || "").slice(0, 10);
        if (daysMap[key]) daysMap[key].scans++;
      });
      // paid signups by created_at (approx — usar profiles paid created_at)
      profs.filter((p) => p.payment_status === "paid").forEach((p) => {
        const key = (p.created_at || "").slice(0, 10);
        if (daysMap[key]) daysMap[key].paid++;
      });
      const dailyData = Object.values(daysMap);

      // Active users (unique user_id with completions last 7d)
      const recent7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const activeUsers = new Set((completions || []).filter((c: any) => c.completed_at >= recent7).map((c: any) => c.user_id)).size;
      const activeUsers30 = new Set((completions || []).map((c: any) => c.user_id)).size;

      // Email stats
      const emailsSent = dedupedEmails.filter((e) => e.status === "sent").length;
      const emailsFailed = dedupedEmails.filter((e) => e.status === "dlq" || e.status === "failed").length;
      const emailsSuppressed = dedupedEmails.filter((e) => e.status === "suppressed").length;
      const templateCounts: Record<string, number> = {};
      dedupedEmails.forEach((e) => {
        templateCounts[e.template_name] = (templateCounts[e.template_name] || 0) + 1;
      });
      const templateData = Object.entries(templateCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ name: k, value: v }));

      // Recent counts
      const newProfiles7 = profs.filter((p) => new Date(p.created_at) >= new Date(d7)).length;
      const newProfiles1 = profs.filter((p) => new Date(p.created_at) >= new Date(d1)).length;
      const newScans7 = scn.filter((s) => new Date(s.created_at) >= new Date(d7)).length;
      const newScans1 = scn.filter((s) => new Date(s.created_at) >= new Date(d1)).length;
      const newPaid7 = profs.filter((p) => p.payment_status === "paid" && new Date(p.created_at) >= new Date(d7)).length;
      const chatMsgs7 = (chats || []).length;

      // Conversions
      const scanToSignup = totalScans > 0 ? Math.round((scn.filter((s) => s.user_id).length / totalScans) * 100) : 0;
      const signupToPaid = totalProfiles > 0 ? Math.round((paid / totalProfiles) * 100) : 0;

      setData({
        totalScans,
        scansWithEmail,
        totalProfiles,
        paid,
        planReady,
        goalsData,
        tiersData,
        dailyData,
        activeUsers,
        activeUsers30,
        emailsSent,
        emailsFailed,
        emailsSuppressed,
        templateData,
        newProfiles7,
        newProfiles1,
        newScans7,
        newScans1,
        newPaid7,
        chatMsgs7,
        scanToSignup,
        signupToPaid,
        miniPlanLeads: lds.length,
      });
      setLoading(false);
    };

  useEffect(() => { load(); }, []);

  const resetMetrics = async () => {
    if (!confirm("¿Resetear TODAS las métricas a 0? Se borrarán: scans, leads, log de emails, completados, logs de entrenos, pesos, PRs, fotos de progreso, mensajes de chat, notificaciones y recordatorios. Las cuentas de usuario NO se borran. Esta acción es irreversible.")) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-metrics");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Métricas reseteadas a 0");
      await load();
    } catch (e: any) {
      toast.error("Error al resetear: " + (e.message || e));
    } finally {
      setResetting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const topStats: Stat[] = [
    { label: "Scans totales", value: data.totalScans, hint: `+${data.newScans7} en 7d`, icon: Camera, accent: true },
    { label: "Registros", value: data.totalProfiles, hint: `+${data.newProfiles7} en 7d`, icon: Users },
    { label: "Pagados", value: data.paid, hint: `+${data.newPaid7} en 7d`, icon: CreditCard, accent: true },
    { label: "Plan entregado", value: data.planReady, icon: CheckCircle2 },
    { label: "Activos 7d", value: data.activeUsers, hint: `${data.activeUsers30} en 30d`, icon: Activity, accent: true },
    { label: "Mensajes chat 7d", value: data.chatMsgs7, icon: Mail },
  ];

  return (
    <div className="space-y-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/70 p-3 backdrop-blur-xl sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
            Panel de métricas
          </span>
        </div>
        <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-primary/25 bg-background/60">
          <RefreshCw className={`w-3.5 h-3.5 sm:mr-1.5 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Actualizar datos</span>
          <span className="sm:hidden">Actualizar</span>
        </Button>
        <Button variant="destructive" size="sm" onClick={resetMetrics} disabled={resetting} className="shadow-[0_4px_18px_-10px_hsl(var(--destructive)/.8)]">
          <Trash2 className="w-3.5 h-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">{resetting ? "Reseteando..." : "Resetear métricas"}</span>
          <span className="sm:hidden">{resetting ? "Reset..." : "Resetear"}</span>
        </Button>
        </div>
      </div>

      {/* Top KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {topStats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-card rounded-xl p-4 border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.accent ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-2xl font-bold font-display text-gradient">{s.value}</div>
            {s.hint && <div className="text-[10px] text-muted-foreground mt-1">{s.hint}</div>}
          </motion.div>
        ))}
      </div>

      {/* Funnel */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">Embudo de conversión</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FunnelStep label="Scans" value={data.totalScans} pct={100} color="bg-primary" />
          <FunnelStep label="Scan con email" value={data.scansWithEmail} pct={data.totalScans ? (data.scansWithEmail / data.totalScans) * 100 : 0} color="bg-primary/80" />
          <FunnelStep label="Registrados" value={data.totalProfiles} pct={data.totalScans ? (data.totalProfiles / data.totalScans) * 100 : 0} color="bg-primary/60" />
          <FunnelStep label="Pagados" value={data.paid} pct={data.totalScans ? (data.paid / data.totalScans) * 100 : 0} color="bg-primary/40" />
        </div>
        <div className="flex gap-6 mt-4 text-xs text-muted-foreground">
          <span>Scan → registro: <span className="text-foreground font-semibold">{data.scanToSignup}%</span></span>
          <span>Registro → pago: <span className="text-foreground font-semibold">{data.signupToPaid}%</span></span>
          <span>Leads mini-plan: <span className="text-foreground font-semibold">{data.miniPlanLeads}</span></span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily signups + scans */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">Actividad diaria (30d)</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="scans" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Scans" />
              <Line type="monotone" dataKey="signups" stroke="#10b981" strokeWidth={2} dot={false} name="Registros" />
              <Line type="monotone" dataKey="paid" stroke="#f59e0b" strokeWidth={2} dot={false} name="Pagados" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Scan goals pie */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">Objetivos del scan</h3>
          </div>
          {data.goalsData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sin datos todavía</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.goalsData} dataKey="value" nameKey="name" outerRadius={80} label={(e: any) => `${e.name}: ${e.value}`}>
                  {data.goalsData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tier breakdown */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Dumbbell className="w-4 h-4 text-primary" />
            <div>
              <h3 className="font-display font-bold text-sm uppercase tracking-wider">Planes elegidos</h3>
              <p className="text-[11px] text-muted-foreground">Distribución entre {data.paid} clientes de pago</p>
            </div>
          </div>
          {data.paid === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Todavía no hay clientes de pago.</p>
          ) : (
            <div className="space-y-5 pt-2">
              {[
                { name: "Completo", key: "full", color: "from-primary to-amber-200", marker: "bg-primary" },
                { name: "Entrenamiento", key: "training", color: "from-sky-500 to-cyan-300", marker: "bg-sky-400" },
                { name: "Transformación", key: "transform", color: "from-violet-500 to-fuchsia-300", marker: "bg-violet-400" },
                { name: "Sin plan", key: "none", color: "from-slate-500 to-slate-300", marker: "bg-slate-400" },
              ].map((tier) => {
                const count = data.tiersData.find((entry: { name: string; value: number }) => entry.name === tier.name)?.value ?? 0;
                const percentage = Math.round((count / data.paid) * 100);
                return (
                  <div key={tier.key} className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tier.marker}`} />
                        <span className="truncate text-sm font-medium">{tier.name}</span>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-2">
                        <span className="font-display text-lg font-bold tabular-nums">{count}</span>
                        <span className="text-xs text-muted-foreground">{percentage}%</span>
                      </div>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-secondary"
                      role="progressbar"
                      aria-label={`${tier.name}: ${percentage}% de clientes`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                    >
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-[width] duration-700 ease-out`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Email templates */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">Emails (30d)</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <MiniStat label="Enviados" value={data.emailsSent} color="text-primary" />
            <MiniStat label="Fallidos" value={data.emailsFailed} color="text-destructive" />
            <MiniStat label="Suprimidos" value={data.emailsSuppressed} color="text-amber-400" />
          </div>
          {data.templateData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Sin emails</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data.templateData} layout="vertical">
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} width={130} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Alerts */}
      {data.emailsFailed > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{data.emailsFailed} emails fallidos</span> en los últimos 30 días. Revisa el log.
          </p>
        </div>
      )}
    </div>
  );
};

function FunnelStep({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold">{pct.toFixed(0)}%</span>
      </div>
      <div className="text-2xl font-bold font-display">{value}</div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold font-display ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default AdminMetrics;