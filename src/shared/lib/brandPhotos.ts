// Fotos reales de la biblioteca de ejercicios (Admin → Ejercicios), compartidas por
// la landing y la app para que ambas se reconozcan como el mismo producto.
//
// Cada foto es la de un ejercicio, y su URL cambia cada vez que el admin la regenera o la
// pasa a WebP (la anterior se borra del bucket). Por eso no se fijan URLs: se piden por id
// (`get_brand_photos_public`, también sin sesión) y se recuerdan en el navegador. Igual que
// `BrandPhotos` en la app nativa (BrandPhotos.swift).
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import fallbackPhoto from "@/shared/assets/landing/hero-athlete.jpg";
import { fastImage } from "./fastImage";

export const BRAND_PHOTO_EXERCISES = {
  gym: "a31c7206-d2a4-4b31-856a-f5dec09b890e",
  dumbbells: "d5e30e05-0791-4886-84a0-7b2695728225",
  home: "14988835-a004-49d6-95c5-63978dbce978",
  pullupBar: "7ab0b27f-f296-4fa6-bf07-8f8b026b0832",
} as const;

type BrandPhotoKey = keyof typeof BRAND_PHOTO_EXERCISES;
const KEYS = Object.keys(BRAND_PHOTO_EXERCISES) as BrandPhotoKey[];
const STORAGE_KEY = "brand-photos-v1";
const RETRY_MS = 60_000;

function readStored(): Partial<Record<BrandPhotoKey, string>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let urls = readStored();
let version = 0;
let inflight: Promise<void> | null = null;
let lastAttempt = 0;
const listeners = new Set<() => void>();

const photo = (key: BrandPhotoKey) => (urls[key] ? fastImage(urls[key]!, 1000) : fallbackPhoto);

/** Siempre la última URL conocida; hasta saberla, una foto local (nunca una imagen rota). */
export const BRAND_PHOTOS = {
  get gym() { return photo("gym"); },
  get dumbbells() { return photo("dumbbells"); },
  get home() { return photo("home"); },
  get pullupBar() { return photo("pullupBar"); },
  meal: "/healthy_meal_plate.jpg",
};

type Row = { id: string; image_url: string | null };

async function fetchRows(): Promise<Row[]> {
  const ids = Object.values(BRAND_PHOTO_EXERCISES);
  // Sin sesión solo responde la función pública; si aún no existe, con sesión basta la tabla.
  const { data, error } = await supabase.rpc("get_brand_photos_public" as never);
  if (!error && Array.isArray(data)) return data as Row[];
  const res = await supabase.from("exercises").select("id, image_url").in("id", ids);
  return (res.data as Row[] | null) ?? [];
}

/** Pide las URLs actuales (una vez a la vez, y como mucho cada minuto si falta alguna). */
export function refreshBrandPhotos(): Promise<void> {
  const complete = KEYS.every((k) => urls[k]);
  if (inflight || (complete && lastAttempt) || Date.now() - lastAttempt < RETRY_MS) return inflight ?? Promise.resolve();
  lastAttempt = Date.now();
  inflight = fetchRows()
    .then((rows) => {
      const next = { ...urls };
      for (const key of KEYS) {
        const url = rows.find((r) => r.id === BRAND_PHOTO_EXERCISES[key])?.image_url;
        if (url) next[key] = url;
      }
      if (JSON.stringify(next) === JSON.stringify(urls)) return;
      urls = next;
      version += 1;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(urls)); } catch { /* modo privado */ }
      listeners.forEach((l) => l());
    })
    .catch(() => undefined)
    .finally(() => { inflight = null; });
  return inflight;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

/** Las fotos de marca de este momento; el componente se repinta cuando llega la URL nueva. */
export function useBrandPhotos() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => { void refreshBrandPhotos(); }, []);
  return BRAND_PHOTOS;
}
