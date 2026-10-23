import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { ListGroup, ListRow } from "@/components/ui/list";
import { forgetAccount, listAccounts, prepareAnotherAccount, switchToAccount, type SavedAccount } from "@/lib/accounts";
import { supportsMultipleAccounts } from "@/lib/platform";
import { clearAnonScanId } from "@/lib/scanAttribution";
import { clearPendingScanContext } from "@/lib/pendingScan";
import { clearConfiguratorDraft } from "@/lib/configuratorDraft";
import { hapticSelection, hapticTap } from "@/lib/native";

/** Lo que no debe pasar de una persona a otra al cambiar de cuenta (igual que al cerrar sesión). */
const clearSharedDrafts = () => { clearAnonScanId(); clearPendingScanContext(); clearConfiguratorDraft(); };

const Avatar = ({ account }: { account: SavedAccount }) => (
  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary type-headline text-primary">
    {account.avatar ? <img src={account.avatar} alt="" className="h-full w-full object-cover" /> : (account.name || account.email).charAt(0).toUpperCase()}
  </span>
);

/**
 * Cuentas guardadas en este dispositivo, como los usuarios de un Mac: tocar una
 * entra en ella y la app se reinicia limpia. Solo en las apps nativas.
 */
export default function AccountSwitcher({ currentId }: { currentId: string }) {
  const [accounts, setAccounts] = useState(listAccounts);
  const [busy, setBusy] = useState(false);
  if (!supportsMultipleAccounts()) return null;

  const switchTo = async (account: SavedAccount) => {
    if (busy || account.id === currentId) return;
    void hapticSelection();
    setBusy(true);
    clearSharedDrafts();
    if (await switchToAccount(account.id)) {
      window.location.assign("/dashboard");
      return;
    }
    setBusy(false);
    setAccounts(listAccounts());
    toast.error(`La sesión de ${account.name} ha caducado. Vuelve a añadir la cuenta.`);
  };

  const addAccount = async () => {
    void hapticTap();
    setBusy(true);
    clearSharedDrafts();
    await prepareAnotherAccount();
    window.location.assign("/login");
  };

  return (
    <ListGroup className="order-[7]" header="Cuentas en este dispositivo" footer="Cambia de cuenta sin cerrar sesión, como los usuarios de un Mac.">
      {accounts.map((a) => (
        <ListRow
          key={a.id}
          leading={<Avatar account={a} />}
          title={a.name}
          subtitle={a.email}
          disabled={busy}
          onClick={a.id === currentId ? undefined : () => void switchTo(a)}
          trailing={a.id === currentId
            ? <Check className="h-5 w-5 text-primary" strokeWidth={2.75} aria-label="Cuenta actual" />
            : <button type="button" className="min-h-11 px-2 type-subhead text-muted-foreground active:opacity-60"
                onClick={(e) => { e.stopPropagation(); forgetAccount(a.id); setAccounts(listAccounts()); }}
                aria-label={`Quitar ${a.name} de este dispositivo`}>Quitar</button>}
        />
      ))}
      <ListRow
        leading={<span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"><Plus className="h-5 w-5" strokeWidth={2.5} /></span>}
        title="Añadir otra cuenta"
        disabled={busy}
        onClick={() => void addAccount()}
      />
    </ListGroup>
  );
}
