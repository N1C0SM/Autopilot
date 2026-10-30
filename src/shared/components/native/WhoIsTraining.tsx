import { useEffect, useRef, useState } from "react";
import { Lock, Plus, Pencil, Star, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/shared/contexts/AuthContext";
import { OPEN_ACCOUNT_PICKER, forgetAccount, getDefaultAccountId, listAccounts, prepareAnotherAccount, setDefaultAccountId, signInSavedAccount, switchToAccount, type SavedAccount } from "@/shared/lib/accounts";
import { supportsMultipleAccounts } from "@/shared/lib/platform";
import { clearAnonScanId } from "@/shared/lib/scanAttribution";
import { clearPendingScanContext } from "@/shared/lib/pendingScan";
import { clearConfiguratorDraft } from "@/shared/lib/configuratorDraft";
import { hapticSelection, hapticTap } from "@/shared/lib/native";

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
  // Cuenta protegida elegida: se pide su contraseña antes de entrar.
  const [asking, setAsking] = useState<SavedAccount | null>(null);
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);

  // Track if we already auto-switched to default this session to avoid loops
  const autoSwitched = useRef(false);

  useEffect(() => {
    if (loading || !supportsMultipleAccounts()) return;
    let shown = false;
    try { shown = sessionStorage.getItem(SHOWN) === "1"; sessionStorage.setItem(SHOWN, "1"); } catch { /* sin almacenamiento: se muestra */ }
    const list = listAccounts();
    const currentLocked = list.some((a) => a.id === user?.id && a.requirePassword);
    const showPicker = () => { setAccounts(listAccounts()); setEditing(false); setOpen(true); };

    // Cuenta predeterminada: se entra directo, sin preguntar. Si no se puede
    // (sesión caducada o sin red), se abre el picker para elegir o volver a entrar.
    if (!shown && !autoSwitched.current) {
      const defId = getDefaultAccountId();
      const defAccount = defId ? list.find((a) => a.id === defId) : null;
      if (defAccount && !defAccount.requirePassword && !defAccount.expired) {
        autoSwitched.current = true;
        if (defAccount.id === user?.id) return; // Ya es la cuenta activa: entra directo.
        void (async () => {
          clearSharedDrafts();
          const result = await switchToAccount(defAccount.id);
          if (result === "ok") { window.location.assign("/dashboard"); return; }
          showPicker();
        })();
        return;
      }
    }

    // Se entra directo con la última cuenta usada (cambiar: mantener el avatar); solo una
    // cuenta protegida pasa por «¿Quién entrena?», igual que en la app nativa.
    if (!shown && currentLocked) showPicker();
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cambio rápido: mantener el avatar o, en el Mac, Cuenta → Cambiar de usuario.
  useEffect(() => {
    if (!supportsMultipleAccounts()) return;
    const show = () => { setAccounts(listAccounts()); setEditing(false); setOpen(true); };
    window.addEventListener(OPEN_ACCOUNT_PICKER, show);
    return () => window.removeEventListener(OPEN_ACCOUNT_PICKER, show);
  }, []);

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
    if (a.requirePassword && !a.expired) { setAsking(a); setPassword(""); setWrong(false); return; }
    if (a.id === user?.id) { setOpen(false); return; }
    setBusy(a.id);
    clearSharedDrafts();
    const result = a.expired ? "expired" : await switchToAccount(a.id);
    if (result === "ok") { window.location.assign("/dashboard"); return; }
    setBusy(null);
    if (result === "offline") { toast.error("Sin conexión. Inténtalo de nuevo cuando vuelvas a tener internet."); return; }
    // La cuenta sigue en la lista: se vuelve a entrar con el correo ya escrito.
    await prepareAnotherAccount();
    window.location.assign(`/login?email=${encodeURIComponent(a.email)}`);
  };

  const unlock = async () => {
    if (!asking || !password || busy) return;
    setBusy(asking.id);
    if (asking.id !== user?.id) clearSharedDrafts();
    const result = await signInSavedAccount(asking.id, password);
    if (result === "ok") {
      if (asking.id === user?.id) { setBusy(null); setAsking(null); setOpen(false); return; }
      window.location.assign("/dashboard");
      return;
    }
    setBusy(null);
    if (result === "offline") { toast.error("Sin conexión. Inténtalo de nuevo cuando vuelvas a tener internet."); return; }
    setWrong(true);
    void hapticTap();
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
      {!editing && !asking && (
        <p className="relative mt-3 max-w-sm text-center type-footnote text-muted-foreground">
          Marca tu cuenta como predeterminada y entrará sola al abrir la app.
        </p>
      )}
      {asking ? (
        <form className="relative mt-8 flex w-full max-w-sm flex-col items-center" onSubmit={(e) => { e.preventDefault(); void unlock(); }}>
          <span className={`${circle} h-24 w-24 bg-gradient-to-br from-primary to-primary/60`}>
            {asking.avatar ? <img src={asking.avatar} alt="" className="h-full w-full object-cover" /> : <span className="font-rounded text-[40px] font-bold text-primary-foreground">{(asking.name || asking.email).charAt(0).toUpperCase()}</span>}
          </span>
          <p className="mt-4 type-title3">{asking.name}</p>
          <label htmlFor="who-password" className="sr-only">Contraseña de {asking.name}</label>
          <input id="who-password" type="password" autoFocus autoComplete="current-password" value={password}
            onChange={(e) => { setPassword(e.target.value); setWrong(false); }} placeholder="Contraseña"
            className={`mt-6 h-12 w-full rounded-full bg-card px-5 text-center type-body outline-none ring-2 transition-shadow ${wrong ? "ring-destructive" : "ring-transparent focus:ring-primary"}`} />
          {wrong && <p role="alert" className="mt-2 type-footnote text-destructive">Contraseña incorrecta</p>}
          <button type="submit" disabled={!password || !!busy} className="mt-5 h-12 w-full rounded-full bg-primary type-headline text-primary-foreground transition-opacity disabled:opacity-40 active:opacity-80">
            {busy ? "Entrando…" : "Entrar"}
          </button>
          <button type="button" onClick={() => setAsking(null)} className="mt-3 min-h-11 type-subhead text-muted-foreground active:opacity-60">Elegir otra cuenta</button>
        </form>
      ) : <>
      <ul className="relative mt-8 flex w-full max-w-md flex-col gap-3">
        {accounts.map((a, i) => {
          const isDefault = getDefaultAccountId() === a.id;
          return (
          <li key={a.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300">
            <button type="button" className={row} disabled={!!busy} onClick={() => void choose(a)}
              aria-label={editing ? `Quitar a ${a.name} de este dispositivo` : `Entrar como ${a.name}${isDefault ? " (predeterminada)" : ""}`}>
              <span className={`${circle} bg-gradient-to-br from-primary to-primary/60`}>
                {a.avatar
                  ? <img src={a.avatar} alt="" className="h-full w-full object-cover" />
                  : <span className="font-rounded text-[24px] font-bold text-primary-foreground">{(a.name || a.email).charAt(0).toUpperCase()}</span>}
                {busy === a.id && <span className="absolute inset-0 animate-pulse bg-black/40" />}
                {isDefault && <Star className="absolute -bottom-0.5 -right-0.5 h-4 w-4 fill-primary text-background" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 truncate type-headline">
                  {a.name}
                  {isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Predeterminada</span>}
                </span>
                <span className={`mt-0.5 block truncate type-subhead ${a.expired ? "text-primary" : "text-muted-foreground"}`}>{a.expired ? "Vuelve a entrar" : a.email}</span>
              </span>
              {!editing && a.requirePassword && <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Pide contraseña" />}
              {editing
                ? <X className="h-5 w-5 shrink-0 text-destructive" strokeWidth={2.5} aria-hidden="true" />
                : !editing && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); hapticTap(); if (isDefault) setDefaultAccountId(null); else setDefaultAccountId(a.id); setAccounts([...listAccounts()]); }}
                    className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors ${isDefault ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                    aria-label={isDefault ? "Quitar predeterminada" : "Fijar como predeterminada"}>
                    <Star className={`h-3.5 w-3.5 ${isDefault ? "fill-primary" : ""}`} />
                    {isDefault ? "Quitar" : "Fijar"}
                  </button>
                )}
            </button>
          </li>
        );
        })}
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
      {!editing && user && !accounts.find((a) => a.id === user.id)?.requirePassword && <button type="button" onClick={() => setOpen(false)} className="relative mt-6 min-h-11 type-subhead text-muted-foreground active:opacity-60">Seguir como {accounts.find((a) => a.id === user.id)?.name ?? "ahora"}</button>}
      <button type="button" onClick={() => { void hapticTap(); setEditing((v) => !v); }}
        className="relative mt-12 inline-flex min-h-11 items-center gap-2 rounded-full px-5 type-subhead text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground active:opacity-60">
        {editing ? "Listo" : <><Pencil className="h-4 w-4" aria-hidden="true" />Gestionar cuentas</>}
      </button>
      </>}
    </div>
  );
}
