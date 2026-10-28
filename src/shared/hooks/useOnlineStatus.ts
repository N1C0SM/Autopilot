import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

const getSnapshot = () => (typeof navigator === "undefined" ? true : navigator.onLine);

/**
 * Estado de la conexión según el sistema (`navigator.onLine` + eventos
 * `online`/`offline`). `useSyncExternalStore` evita desajustes entre el primer
 * render y el estado real, y no dispara renders si el valor no cambia.
 */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
