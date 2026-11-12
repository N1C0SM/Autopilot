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
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, url]) => typeof url === "string" && !/\.(gif|apng)(\?|$)/i.test(url)));
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

type Row = { slot?: string | null; id?: string | null; name?: string | null; image_url?: string | null };

/**
 * Si el ejercicio de una foto ya no está en la biblioteca (se borró o se reimportó), la foto es la
 * del primer ejercicio publicado, por nombre, que encaje con su tipo. Igual que
 * `get_brand_photos_public` y `BrandPhotos.pick` (iPhone/Mac). Cada hueco, un ejercicio distinto.
 */
const SLOTS: { key: BrandPhotoKey; patterns: string[]; excludes: string[] }[] = [
  { key: "pullupBar", patterns: ["dominada", "chin", "pull"], excludes: ["pullover", "mancuerna"] },
  { key: "dumbbells", patterns: ["mancuerna"], excludes: [] },
  { key: "home", patterns: ["goblet", "flexi", "zancada", "plancha", "burpee"], excludes: ["mancuerna"] },
  { key: "gym", patterns: ["press", "sentadilla", "peso muerto"], excludes: ["mancuerna"] },
];

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Fotos fijas: un GIF o APNG de técnica no sirve de portada. */
const isStill = (url: string | null | undefined) => Boolean(url) && !/\.(gif|apng)(\?|$)/i.test(url!);

export function pickBrandPhotos(rows: Row[]): Partial<Record<BrandPhotoKey, string>> {
  const out: Partial<Record<BrandPhotoKey, string>> = {};
  for (const row of rows) {
    if (row.slot && row.slot in BRAND_PHOTO_EXERCISES && isStill(row.image_url)) out[row.slot as BrandPhotoKey] = row.image_url!;
  }
  const live = rows
    .filter((row) => row.id && isStill(row.image_url))
    .sort((a, b) => (fold(a.name ?? "") < fold(b.name ?? "") ? -1 : fold(a.name ?? "") > fold(b.name ?? "") ? 1 : 0));
  const used = new Set(Object.values(out));
  for (const slot of SLOTS) {
    if (out[slot.key]) continue;
    const row = live.find((r) => r.id === BRAND_PHOTO_EXERCISES[slot.key])
      ?? live.find((r) => {
        const name = fold(r.name ?? "");
        return !used.has(r.image_url!) && slot.patterns.some((p) => name.includes(p)) && !slot.excludes.some((p) => name.includes(p));
      });
    if (row?.image_url) {
      out[slot.key] = row.image_url;
      used.add(row.image_url);
    }
  }
  return out;
}

async function fetchPhotos(): Promise<Partial<Record<BrandPhotoKey, string>>> {
  // Primero la función pública (vale sin sesión); con sesión, si falta alguna, la tabla.
  const { data, error } = await supabase.rpc("get_brand_photos_public" as never);
  let picked = !error && Array.isArray(data) ? pickBrandPhotos(data as Row[]) : {};
  if (KEYS.some((key) => !picked[key])) {
    // Una consulta pequeña por hueco que falte (una sola con todo se cortaba antes de llegar a algunos).
    const own = await supabase.from("exercises").select("id, name, image_url").in("id", Object.values(BRAND_PHOTO_EXERCISES));
    const rows: Row[] = [...((own.data as Row[] | null) ?? [])];
    for (const slot of SLOTS.filter((s) => !picked[s.key])) {
      const res = await supabase.from("exercises").select("id, name, image_url")
        .in("status", ["published", "archived"]).not("image_url", "is", null)
        .or(slot.patterns.map((p) => `name.ilike.*${p.replace(/ /g, "*")}*`).join(",")).order("name").limit(25);
      rows.push(...((res.data as Row[] | null) ?? []));
    }
    picked = { ...pickBrandPhotos(rows), ...picked };
  }
  return picked;
}

/** Pide las URLs actuales (una vez a la vez, y como mucho cada minuto si falta alguna). */
export function refreshBrandPhotos(): Promise<void> {
  const complete = KEYS.every((k) => urls[k]);
  if (inflight || (complete && lastAttempt) || Date.now() - lastAttempt < RETRY_MS) return inflight ?? Promise.resolve();
  lastAttempt = Date.now();
  inflight = fetchPhotos()
    .then((picked) => {
      const next = { ...urls, ...picked };
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
