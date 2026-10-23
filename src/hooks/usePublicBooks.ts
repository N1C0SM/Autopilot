import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isIOSNative } from "@/lib/platform";

export interface PublicBook { id: string; title: string; price: string; cover: string; is_pack: boolean; pages: number | null }

// Una sola carga por visita, compartida por todas las secciones que enseñan guías.
let cache: Promise<PublicBook[]> | null = null;

async function load(): Promise<PublicBook[]> {
  // Mismo origen que /recursos: libros publicados dentro de la carpeta «Libros».
  const { data: folder } = await supabase.from("library_books").select("id").eq("is_folder", true).ilike("title", "libros").limit(1).maybeSingle();
  if (!folder) return [];
  const { data } = await supabase.from("library_books").select("id, title, price, cover_path, is_pack, pages")
    .eq("published", true).eq("is_folder", false).eq("parent_id", folder.id).order("sort_order", { ascending: true });
  const list: PublicBook[] = [];
  for (const b of data || []) {
    let cover = "";
    if (b.cover_path?.startsWith("http")) cover = b.cover_path;
    else if (b.cover_path) cover = (await supabase.storage.from("library").createSignedUrl(b.cover_path, 3600)).data?.signedUrl || "";
    list.push({ id: b.id, title: b.title, price: b.price || "", cover, is_pack: !!b.is_pack, pages: b.pages ?? null });
  }
  return list.sort((a, b) => Number(b.is_pack) - Number(a.is_pack));
}

/** Guías publicadas para escaparates públicos (pack primero). `null` mientras carga. */
export function usePublicBooks() {
  const [books, setBooks] = useState<PublicBook[] | null>(null);
  useEffect(() => {
    // App Store §3.1.1: en iOS no se anuncian bienes digitales de pago.
    if (isIOSNative()) { setBooks([]); return; }
    let alive = true;
    cache ??= load().catch(() => { cache = null; return []; });
    void cache.then((list) => { if (alive) setBooks(list); });
    return () => { alive = false; };
  }, []);
  return books;
}
