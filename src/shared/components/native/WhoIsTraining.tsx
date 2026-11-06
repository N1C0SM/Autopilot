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
import { BrandMark } from "@/shared/components/ui/brand-mark";

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

  // Tarjetas sin borde (22 px) como el resto de la app: foto redonda, nombre y correo.
  const row = "flex w-full min-h-[76px] items-center gap-4 rounded-[22px] bg-card py-3 pl-3 pr-4 text-left ring-2 ring-transparent transition-[transform,box-shadow] duration-200 ease-out hover:ring-foreground/10 focus-visible:outline-none focus-visible:ring-primary active:scale-[0.98]";
  const circle = "relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary";
  const initial = (a: SavedAccount, size: string) => <span className={`font-rounded ${size} font-bold text-primary`}>{(a.name || a.email).charAt(0).toUpperCase()}</span>;
  const toggleDefault = (a: SavedAccount, isDefault: boolean) => {
    void hapticTap();
    setDefaultAccountId(isDefault ? null : a.id);
    setAccounts([...listAccounts()]);
  };
  const current = accounts.find((a) => a.id === user?.id);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="who-title"
      className="fixed inset-0 z-[80] flex flex-col items-center overflow-y-auto bg-background px-5 pb-[max(2rem,var(--safe-bottom))] pt-[max(3.5rem,var(--safe-top))] animate-in fade-in duration-300">
      <div className="my-auto flex w-full max-w-md flex-col items-center">
      {/* Misma cabecera que «Hola de nuevo»: la «A» con rayo, AUTOPILOT y el título. */}
      <div className="flex flex-col items-center" aria-label="Autopilot" role="img">
        <BrandMark size={44} />
        <span aria-hidden="true" className="mt-2.5 text-[20px] font-bold leading-none tracking-[0.06em] text-foreground">AUTOPILOT</span>
      </div>
      <h1 id="who-title" className="mt-6 text-center text-[28px] font-bold leading-tight tracking-[-0.02em]">
        {asking ? asking.name : editing ? "Gestionar cuentas" : "¿Quién entrena?"}
      </h1>
      <p className="mx-auto mt-2 max-w-[34ch] text-center text-[15px] text-foreground/75">
        {asking ? "Introduce tu contraseña para continuar."
          : editing ? "Quita las cuentas que ya no usen este dispositivo."
          : "Elige tu cuenta. Marca una como predeterminada y entrará sola al abrir la app."}
      </p>
      {asking ? (
        <form className="mt-8 flex w-full flex-col items-center" onSubmit={(e) => { e.preventDefault(); void unlock(); }}>
          <span className={`${circle} h-20 w-20`}>
            {asking.avatar ? <img src={asking.avatar} alt="" className="h-full w-full object-cover" /> : initial(asking, "text-[34px]")}
          </span>
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
      <ul className="mt-8 flex w-full flex-col gap-2.5">
        {accounts.map((a, i) => {
          const isDefault = getDefaultAccountId() === a.id;
          return (
          <li key={a.id} style={{ animationDelay: `${i * 50}ms` }} className="relative animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300">
            <button type="button" className={`${row} ${editing ? "" : "pr-[6.5rem]"}`} disabled={!!busy} onClick={() => void choose(a)}
              aria-label={editing ? `Quitar a ${a.name} de este dispositivo` : `Entrar como ${a.name}${isDefault ? " (predeterminada)" : ""}${a.requirePassword ? ", pide contraseña" : ""}`}>
              <span className={circle}>
                {a.avatar ? <img src={a.avatar} alt="" className="h-full w-full object-cover" /> : initial(a, "text-[22px]")}
                {busy === a.id && <span className="absolute inset-0 animate-pulse bg-black/40" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 type-headline">
                  <span className="truncate">{a.name}</span>
                  {a.requirePassword && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                </span>
                <span className={`mt-0.5 block truncate type-subhead ${a.expired ? "text-primary" : isDefault ? "text-primary" : "text-muted-foreground"}`}>
                  {a.expired ? "Vuelve a entrar" : isDefault ? "Predeterminada" : a.email}
                </span>
              </span>
              {editing && <X className="h-5 w-5 shrink-0 text-destructive" strokeWidth={2.5} aria-hidden="true" />}
            </button>
            {/* Botón hermano (no anidado): fijar o quitar la cuenta predeterminada. */}
            {!editing && (
              <button type="button" disabled={!!busy || (!isDefault && (a.requirePassword || a.expired))} onClick={() => toggleDefault(a, isDefault)}
                className={`absolute right-3 top-1/2 flex h-11 -translate-y-1/2 items-center gap-1.5 rounded-full px-3.5 type-footnote font-semibold transition-colors disabled:opacity-40 ${isDefault ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                aria-label={isDefault ? `Quitar ${a.name} como predeterminada` : `Fijar ${a.name} como predeterminada`} aria-pressed={isDefault}>
                <Star className={`h-3.5 w-3.5 ${isDefault ? "fill-primary" : ""}`} aria-hidden="true" />
                {isDefault ? "Quitar" : "Fijar"}
              </button>
            )}
          </li>
        );
        })}
        {!editing && (
          <li className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300" style={{ animationDelay: `${accounts.length * 50}ms` }}>
            <button type="button" className={row} disabled={!!busy} onClick={() => void add()}>
              <span className={circle}><Plus className="h-6 w-6 text-primary" strokeWidth={2.5} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block type-headline">Añadir cuenta</span>
                <span className="mt-0.5 block type-subhead text-muted-foreground">Otra persona en este dispositivo</span>
              </span>
            </button>
          </li>
        )}
      </ul>
      {!editing && user && !current?.requirePassword && <button type="button" onClick={() => setOpen(false)} className="mt-6 min-h-11 type-subhead text-muted-foreground active:opacity-60">Seguir como {current?.name ?? "ahora"}</button>}
      <button type="button" onClick={() => { void hapticTap(); setEditing((v) => !v); }}
        className={`${editing ? "mt-6 h-12 w-full bg-primary type-headline text-primary-foreground" : "mt-2 min-h-11 type-subhead text-muted-foreground"} inline-flex items-center justify-center gap-2 rounded-full px-5 transition-opacity active:opacity-60`}>
        {editing ? "Listo" : <><Pencil className="h-4 w-4" aria-hidden="true" />Gestionar cuentas</>}
      </button>
      </>}
      </div>
    </div>
  );
}
