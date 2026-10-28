import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { StatusBadge } from "@/shared/components/ui/status-badge";
import { Spinner } from "@/shared/components/ui/spinner";
import { ListGroup } from "@/shared/components/ui/list";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { hapticTap, hapticNotify, hapticSelection } from "@/shared/lib/native";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { supabase } from "@/shared/integrations/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/app/pages/Admin";

interface Props { users: Profile[] }

const DEFAULT_SUBJECT = "Tu plan personalizado te está esperando";
const DEFAULT_BODY = `Te registraste en Autopilot pero todavía no has activado tu plan. Tu entrenamiento + nutrición personalizados están listos para empezar a transformar tu rutina.

Solo te llevará 1 minuto. Empieza hoy y recibe tu plan completo en Google Calendar mañana mismo.`;

const PaymentReminders = ({ users }: Props) => {
  const isMobile = useIsMobile();
  const unpaid = useMemo(() => users.filter(u => u.payment_status !== "paid"), [users]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sending, setSending] = useState(false);
  const [lastSentMap, setLastSentMap] = useState<Record<string, string>>({});

  const filtered = unpaid.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_reminders")
        .select("user_id, sent_at")
        .order("sent_at", { ascending: false });
      if (data) {
        const map: Record<string, string> = {};
        for (const r of data) if (!map[r.user_id]) map[r.user_id] = r.sent_at;
        setLastSentMap(map);
      }
    })();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(filtered.map(u => u.user_id)));
  const clearAll = () => setSelected(new Set());

  const daysSince = (iso?: string) => {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  };

  const send = async () => {
    if (selected.size === 0) { toast.error("Selecciona al menos un usuario"); return; }
    setSending(true);
    const targets = unpaid.filter(u => selected.has(u.user_id));
    let ok = 0, skip = 0, fail = 0;
    const { data: auth } = await supabase.auth.getUser();
    const sentBy = auth.user?.id;

    for (const u of targets) {
      const last = lastSentMap[u.user_id];
      const ds = daysSince(last);
      if (ds !== null && ds < 3) { skip++; continue; }
      try {
        const { data: sendData, error } = await supabase.functions.invoke("send-payment-reminder", {
          body: {
            recipientEmail: u.email,
            idempotencyKey: `pay-reminder-${u.user_id}-${Date.now()}`,
            templateData: {
              name: u.email.split("@")[0],
              customMessage: body,
              checkoutUrl: "https://autopilotplan.com/dashboard",
            },
          },
        });
        if (error) throw error;
        if (!sendData?.sent) { skip++; continue; }
        await supabase.from("payment_reminders").insert({
          user_id: u.user_id,
          recipient_email: u.email,
          subject,
          body,
          sent_by: sentBy,
        });
        ok++;
      } catch (e) { fail++; console.error(e); }
    }
    setSending(false);
    setDialogOpen(false);
    setSelected(new Set());
    void hapticNotify(fail ? "warning" : "success");
    toast.success(`Enviados: ${ok}${skip ? ` · Saltados (cooldown 3d): ${skip}` : ""}${fail ? ` · Fallidos: ${fail}` : ""}`);

    // Refresh last sent map
    const { data } = await supabase.from("payment_reminders").select("user_id, sent_at").order("sent_at", { ascending: false });
    if (data) {
      const map: Record<string, string> = {};
      for (const r of data) if (!map[r.user_id]) map[r.user_id] = r.sent_at;
      setLastSentMap(map);
    }
  };

  return (
    <div className="space-y-4">
      <p className="type-subhead text-muted-foreground">
        {unpaid.length} usuario{unpaid.length !== 1 ? "s" : ""} registrado{unpaid.length !== 1 ? "s" : ""} sin pagar. Cooldown de 3 días por usuario.
      </p>

      <div className="space-y-1">
        <Input type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Buscar por email…" aria-label="Buscar por email" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex items-center justify-between">
          <Button variant="plain" className="px-0" onClick={() => { void hapticTap(); selectAll(); }}>Seleccionar todos ({filtered.length})</Button>
          {selected.size > 0 && <Button variant="plain" className="px-0" onClick={() => { void hapticTap(); clearAll(); }}>Limpiar ({selected.size})</Button>}
        </div>
      </div>

      <Button size="lg" className="w-full md:w-auto" onClick={() => { void hapticTap(); setDialogOpen(true); }} disabled={selected.size === 0}>
        Enviar a {selected.size}
      </Button>

      {filtered.length === 0 ? (
        <EmptyState icon={Mail} title="No hay usuarios sin pagar" description="Cuando alguien se registre y no pague, aparecerá aquí." />
      ) : (
        <ListGroup>
          {filtered.map(u => {
            const ds = daysSince(lastSentMap[u.user_id]);
            const cooldown = ds !== null && ds < 3;
            return (
              <div
                key={u.user_id}
                onClick={() => { void hapticSelection(); toggle(u.user_id); }}
                className="group/row flex min-h-[56px] cursor-pointer items-center gap-3 px-4 transition-colors duration-150 active:bg-accent has-[:focus-visible]:bg-accent"
              >
                <Checkbox checked={selected.has(u.user_id)} onCheckedChange={() => { void hapticSelection(); toggle(u.user_id); }} onClick={e => e.stopPropagation()} aria-label={`Seleccionar ${u.email}`} />
                <div className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2 group-[:not(:last-child)]/row:sep-b">
                  <div className="min-w-0 flex-1">
                    <div className="truncate type-body">{u.email}</div>
                    <div className="type-footnote text-muted-foreground">
                      Registrado {new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      {ds !== null && ` · Último email hace ${ds}d`}
                    </div>
                  </div>
                  {cooldown && <StatusBadge className="type-caption1">En espera</StatusBadge>}
                  {lastSentMap[u.user_id] && !cooldown && <StatusBadge tone="success" className="type-caption1">Enviado</StatusBadge>}
                </div>
              </div>
            );
          })}
        </ListGroup>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" onOpenAutoFocus={isMobile ? (e) => e.preventDefault() : undefined}>
          <DialogHeader>
            <DialogTitle>Recordatorio a {selected.size} usuario{selected.size !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="reminder-subject" className="mb-1.5 block type-footnote text-muted-foreground">Asunto</label>
              <Input id="reminder-subject" enterKeyHint="next" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label htmlFor="reminder-body" className="mb-1.5 block type-footnote text-muted-foreground">Mensaje</label>
              <Textarea id="reminder-body" value={body} onChange={e => setBody(e.target.value)} rows={8} />
              <p className="mt-1.5 type-footnote text-muted-foreground">El email incluye un botón "Activar mi plan" automáticamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="plain" className="w-full sm:w-auto" onClick={() => setDialogOpen(false)} disabled={sending}>Cancelar</Button>
            <Button size="lg" className="w-full sm:w-auto" onClick={() => { void hapticTap(); void send(); }} disabled={sending}>
              {sending && <Spinner size="sm" className="text-primary-foreground" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentReminders;
