import { useRef } from "react";
import { openAccountPicker } from "@/shared/lib/accounts";
import { supportsMultipleAccounts } from "@/shared/lib/platform";
import { hapticImpact } from "@/shared/lib/native";

/**
 * Mantener pulsado un avatar abre «¿Quién entrena?» (solo apps nativas).
 * `consumed()` dice si el toque fue una pulsación larga, para no hacer además el toque normal.
 */
export function useAccountLongPress() {
  const fired = useRef(false);
  const timer = useRef<number>();
  const cancel = () => window.clearTimeout(timer.current);
  const handlers = supportsMultipleAccounts() ? {
    onPointerDown: () => {
      fired.current = false;
      timer.current = window.setTimeout(() => {
        fired.current = true;
        void hapticImpact("medium");
        openAccountPicker();
      }, 450);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  } : {};
  const consumed = () => { const was = fired.current; fired.current = false; return was; };
  return { handlers, consumed };
}
