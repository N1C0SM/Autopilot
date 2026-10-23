import { useEffect, useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { forgetAccount, listAccounts, prepareAnotherAccount, switchToAccount, type SavedAccount } from "@/lib/accounts";
import { supportsMultipleAccounts } from "@/lib/platform";
import { clearAnonScanId } from "@/lib/scanAttribution";
import { clearPendingScanContext } from "@/lib/pendingScan";
import { clearConfiguratorDraft } from "@/lib/configuratorDraft";
import { hapticSelection, hapticTap } from "@/lib/native";

const SHOWN = "autopilot.whoIsTraining.shown";

/** Lo que no debe pasar de una persona a otra al cambiar de cuenta (igual que al cerrar sesión). */
const clearSharedDrafts = () => { clearAnonScanId(); clearPendingScanContext(); clearConfiguratorDraft(); };

/**
 * «¿Quién entrena?», como los perfiles de Netflix: al abrir la app nativa con varias
 * cuentas guardadas, cada persona toca su ficha y entra en su cuenta. Una vez por apertura.
 */
export default function WhoIsTraining() {
  const { user, loading } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !supportsMultipleAccounts()) return;
    let shown = false;
    try { shown = sessionStorage.getItem(SHOWN) === "1"; sessionStorage.setItem(SHOWN, "1"); } catch { /* sin almacenamiento: se muestra */ }
    const list = listAccounts();
    if (!shown && list.length >= 2) { setAccounts(list); setOpen(true); }
  }, [loading]);

  if (!open) return null;

  const choose = async (a: SavedAccount) => {
    if (busy) return;
    if (editing) {
      void hapticTap();
      forgetAccount(a.id);
      const next = listAccounts();
      setAccounts(next);
      if (next.length < 2) setEditing(false);
      return;
    }
    void hapticSelection();
    if (a.id === user?.id) { setOpen(false); return; }
    setBusy(a.id);
    clearSharedDrafts();
    if (await switchToAccount(a.id)) { window.location.assign("/dashboard"); return; }
    setBusy(null);
    setAccounts(listAccounts());
    toast.error(`La sesión de ${a.name} ha caducado. Añádela de nuevo.`);
  };

  const add = async () => {
    void hapticTap();
    setBusy("add");
    clearSharedDrafts();
    await prepareAnotherAccount();
    window.location.assign("/login");
  };

  // Filas anchas, como la lista de usuarios: foto redonda a la izquierda, nombre y correo.
  const row = "group flex w-full items-center gap-4 rounded-full bg-card py-3 pl-3 pr-6 text-left ring-2 ring-transparent transition-[transform,box-shadow] duration-200 ease-out hover:ring-foreground/20 focus-visible:outline-none focus-visible:ring-primary active:scale-[0.98]";
  const circle = "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="who-title"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto bg-background px-5 pb-[max(2rem,var(--safe-bottom))] pt-[max(3rem,var(--safe-top))] animate-in fade-in duration-300">
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.14),transparent)]" />
      <p className="relative mb-3 type-headline text-primary">Autopilot</p>
      <h1 id="who-title" className="relative text-center font-rounded text-[34px] font-bold leading-tight tracking-tight sm:text-[44px]">
        {editing ? "Gestionar cuentas" : "¿Quién entrena?"}
      </h1>
      <ul className="relative mt-8 flex w-full max-w-md flex-col gap-3">
        {accounts.map((a, i) => (
          <li key={a.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300">
            <button type="button" className={row} disabled={!!busy} onClick={() => void choose(a)}
              aria-label={editing ? `Quitar a ${a.name} de este dispositivo` : `Entrar como ${a.name}`}>
              <span className={`${circle} bg-gradient-to-br from-primary to-primary/60`}>
                {a.avatar
                  ? <img src={a.avatar} alt="" className="h-full w-full object-cover" />
                  : <span className="font-rounded text-[24px] font-bold text-primary-foreground">{(a.name || a.email).charAt(0).toUpperCase()}</span>}
                {busy === a.id && <span className="absolute inset-0 animate-pulse bg-black/40" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate type-headline">{a.name}</span>
                <span className="mt-0.5 block truncate type-subhead text-muted-foreground">{a.email}</span>
              </span>
              {editing
                ? <X className="h-5 w-5 shrink-0 text-destructive" strokeWidth={2.5} aria-hidden="true" />
                : a.id === user?.id && <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 type-caption1 font-semibold text-primary">Abierta</span>}
            </button>
          </li>
        ))}
        {!editing && (
          <li className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300" style={{ animationDelay: `${accounts.length * 60}ms` }}>
            <button type="button" className={row} disabled={!!busy} onClick={() => void add()}>
              <span className={`${circle} bg-secondary`}><Plus className="h-6 w-6 text-primary" strokeWidth={2.5} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block type-headline">Añadir cuenta</span>
                <span className="mt-0.5 block type-subhead text-muted-foreground">Otra persona en este dispositivo</span>
              </span>
            </button>
          </li>
        )}
      </ul>
      <button type="button" onClick={() => { void hapticTap(); setEditing((v) => !v); }}
        className="relative mt-12 inline-flex min-h-11 items-center gap-2 rounded-full px-5 type-subhead text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground active:opacity-60">
        {editing ? "Listo" : <><Pencil className="h-4 w-4" aria-hidden="true" />Gestionar cuentas</>}
      </button>
    </div>
  );
}
