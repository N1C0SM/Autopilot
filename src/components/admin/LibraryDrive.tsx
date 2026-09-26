import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  Image as ImageIcon,
  ArrowLeft,
  ChevronRight,
  Eye,
  Package,
  Lock,
  Globe,
  BookOpen,
  Video,
  Star,
} from "lucide-react";
import { toast } from "sonner";

type Kind = "folder" | "book" | "pack" | "video" | "recommendation";

interface Book {
  id: string;
  title: string;
  description: string;
  price: string;
  buy_url?: string | null;
  video_url?: string | null;
  kind: Kind;
  folder: string;
  cover_path: string | null;
  file_path: string | null;
  is_pack: boolean;
  is_folder: boolean;
  parent_id: string | null;
  published: boolean;
  sort_order: number;
  pack_items?: string[];
}

const KIND_LABEL: Record<Kind, string> = {
  folder: "Carpeta",
  book: "Libro",
  pack: "Pack",
  video: "Vídeo",
  recommendation: "Recomendación",
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `libro-${Date.now()}`;

const LibraryDrive = () => {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [path, setPath] = useState<{ id: string; title: string }[]>([]);

  const parentId = path.length ? path[path.length - 1].id : null;

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("library_books")
      .select("*")
      .order("is_folder", { ascending: false })
      .order("sort_order", { ascending: true });
    if (error) toast.error("No se pudo cargar tu biblioteca");
    setBooks((data as Book[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Firmar portadas para poder verlas (el almacén es privado)
  useEffect(() => {
    (async () => {
      const pending = books.filter((b) => b.cover_path && !covers[b.id]);
      if (pending.length === 0) return;
      const entries: Record<string, string> = {};
      for (const b of pending) {
        if (b.cover_path!.startsWith("http")) { entries[b.id] = b.cover_path!; continue; }
        const { data } = await supabase.storage.from("library").createSignedUrl(b.cover_path!, 3600);
        if (data?.signedUrl) entries[b.id] = data.signedUrl;
      }
      if (Object.keys(entries).length) setCovers((c) => ({ ...c, ...entries }));
    })();
  }, [books]);

  const create = async (kind: Kind) => {
    const title =
      kind === "pack" ? "Pack completo"
      : kind === "folder" ? "Nueva carpeta"
      : kind === "video" ? "Nuevo vídeo"
      : kind === "recommendation" ? "Nueva recomendación"
      : "Nuevo libro";
    const folder = slugify(`${kind}-${books.length + 1}`);
    const { data, error } = await (supabase as any)
      .from("library_books")
      .insert({
        title,
        folder,
        kind,
        is_pack: kind === "pack",
        is_folder: kind === "folder",
        parent_id: parentId,
        sort_order: books.length,
      })
      .select()
      .single();
    if (error) {
      toast.error("No se pudo crear");
      return;
    }
    setBooks((b) => [...b, data as Book]);
    if (kind === "folder") setPath((p) => [...p, { id: (data as Book).id, title }]);
    else setOpenId((data as Book).id);
  };

  const patch = (id: string, p: Partial<Book>) =>
    setBooks((arr) => arr.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const save = async (b: Book) => {
    setBusy(b.id);
    const { error } = await (supabase as any)
      .from("library_books")
      .update({
        title: b.title,
        description: b.description,
        price: b.price,
        buy_url: b.buy_url?.trim() || null,
        video_url: b.video_url?.trim() || null,
        pack_items: b.pack_items || [],
        published: b.published,
      })
      .eq("id", b.id);
    setBusy(null);
    if (error) toast.error("No se pudo guardar");
    else toast.success("Guardado");
  };

  const rename = async (b: Book) => {
    const title = prompt("Nombre de la carpeta", b.title);
    if (!title) return;
    await (supabase as any).from("library_books").update({ title }).eq("id", b.id);
    patch(b.id, { title });
  };

  const remove = async (b: Book) => {
    if (!confirm(`¿Eliminar "${b.title}" y todo lo que contiene?`)) return;
    const paths = [b.cover_path, b.file_path].filter((x) => x && !x.startsWith("http")) as string[];
    if (paths.length) await supabase.storage.from("library").remove(paths);
    await (supabase as any).from("library_books").delete().eq("id", b.id);
    setOpenId(null);
    toast.success("Eliminado");
    load();
  };

  const upload = async (b: Book, kind: "cover" | "file", file: File) => {
    setBusy(b.id);
    try {
      const ext = file.name.split(".").pop() || (kind === "cover" ? "jpg" : "pdf");
      const path = `${b.folder}/${kind === "cover" ? "portada" : "libro"}-${Date.now()}.${ext}`;
      const bucket = kind === "cover" ? "site-assets" : "library";
      const finalPath = kind === "cover" ? `library-covers/${path}` : path;
      const { error } = await supabase.storage.from(bucket).upload(finalPath, file, {
        upsert: false,
        contentType: file.type || (kind === "cover" ? "image/jpeg" : "application/pdf"),
      });
      if (error) throw error;
      const old = kind === "cover" ? b.cover_path : b.file_path;
      if (old && !old.startsWith("http")) await supabase.storage.from("library").remove([old]);
      const col = kind === "cover" ? "cover_path" : "file_path";
      const value = kind === "cover"
        ? supabase.storage.from("site-assets").getPublicUrl(finalPath).data.publicUrl
        : path;
      await (supabase as any).from("library_books").update({ [col]: value }).eq("id", b.id);
      patch(b.id, { [col]: value } as Partial<Book>);
      if (kind === "cover") setCovers((c) => ({ ...c, [b.id]: value }));
      toast.success(kind === "cover" ? "Portada subida" : "Archivo subido");
    } catch (err: any) {
      toast.error(err.message || "Error al subir");
    } finally {
      setBusy(null);
    }
  };

  const [priceTip, setPriceTip] = useState("");
  const suggestPrice = async (b: Book) => {
    setBusy("price"); setPriceTip("");
    const { data, error } = await supabase.functions.invoke("suggest-book-price", {
      body: { title: b.title, description: b.description, is_pack: b.kind === "pack", others: books.filter((x) => x.kind !== "folder" && x.id !== b.id && x.price).map((x) => `${x.title}: ${x.price}`) },
    });
    setBusy(null);
    if (error || !data?.price) { toast.error("No se pudo sugerir un precio"); return; }
    patch(b.id, { price: data.price });
    setPriceTip(data.reason || "");
  };

  const openFile = async (p: string) => {
    const { data, error } = await supabase.storage.from("library").createSignedUrl(p, 600);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo abrir el archivo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando tu biblioteca…
      </div>
    );
  }

  const open = books.find((b) => b.id === openId) || null;

  if (open) {
    const kind: Kind = open.kind || (open.is_pack ? "pack" : open.is_folder ? "folder" : "book");
    const isBook = kind === "book";
    const isPack = kind === "pack";
    const isVideo = kind === "video";
    const isRec = kind === "recommendation";

    return (
      <div className="space-y-5">
        <button
          onClick={() => setOpenId(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            {isPack ? <Package className="w-5 h-5 text-primary" />
              : isVideo ? <Video className="w-5 h-5 text-primary" />
              : isRec ? <Star className="w-5 h-5 text-primary" />
              : <FolderOpen className="w-5 h-5 text-primary" />}
            <h2 className="font-display font-bold">{open.title || "Sin título"}</h2>
            <span className="text-[10px] uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {KIND_LABEL[kind]}
            </span>
          </div>

          {isBook && (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Portada */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Portada</Label>
              {covers[open.id] ? (
                <img src={covers[open.id]} alt="Portada" className="w-full aspect-[3/4] object-cover rounded-xl border border-border" />
              ) : (
                <div className="w-full aspect-[3/4] rounded-xl bg-secondary/50 border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground gap-1.5">
                  <ImageIcon className="w-4 h-4" /> Sin portada
                </div>
              )}
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(open, "cover", f);
                  }}
                />
                <span className="inline-flex w-full justify-center items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border hover:bg-secondary">
                  <Upload className="w-3.5 h-3.5" /> {open.cover_path ? "Cambiar portada" : "Subir portada"}
                </span>
              </label>
            </div>

            {/* Archivo del libro */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Archivo del libro (PDF)</Label>
              {open.file_path ? (
                <div className="w-full aspect-[3/4] rounded-xl bg-secondary/40 border border-border flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <FileText className="w-8 h-8 text-primary" />
                  <p className="text-[11px] text-muted-foreground break-all">{open.file_path.split("/").pop()}</p>
                  <Button size="sm" variant="secondary" onClick={() => openFile(open.file_path!)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Abrir
                  </Button>
                </div>
              ) : (
                <div className="w-full aspect-[3/4] rounded-xl bg-secondary/50 border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground gap-1.5">
                  <FileText className="w-4 h-4" /> Sin archivo
                </div>
              )}
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="application/pdf,application/zip,application/epub+zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(open, "file", f);
                  }}
                />
                <span className="inline-flex w-full justify-center items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90">
                  {busy === open.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {open.file_path ? "Reemplazar archivo" : "Subir archivo"}
                </span>
              </label>
            </div>
          </div>
          )}

          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={open.title} onChange={(e) => patch(open.id, { title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea
                rows={3}
                value={open.description}
                placeholder={isVideo ? "Qué se explica en el vídeo" : "De qué trata y a quién le sirve"}
                onChange={(e) => patch(open.id, { description: e.target.value })}
              />
            </div>

            {isVideo && (
              <div>
                <Label className="text-xs">Enlace del vídeo (YouTube, Vimeo…)</Label>
                <Input
                  value={open.video_url || ""}
                  placeholder="https://…"
                  onChange={(e) => patch(open.id, { video_url: e.target.value })}
                />
              </div>
            )}

            {(isBook || isPack) && (
              <div className="sm:max-w-[200px]">
                <Label className="text-xs">Precio</Label>
                <Input
                  value={open.price}
                  placeholder="Gratis, 19 €…"
                  onChange={(e) => patch(open.id, { price: e.target.value })}
                />
                <Button type="button" size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" disabled={busy === "price"} onClick={() => suggestPrice(open)}>
                  {busy === "price" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : "✨"} Sugerir precio con IA
                </Button>
                {priceTip && <p className="text-[11px] text-muted-foreground mt-1">{priceTip}</p>}
              </div>
            )}

            {(isBook || isPack || isRec) && (
              <div>
                <Label className="text-xs">{isRec ? "Enlace de la recomendación" : "Enlace de compra (Stripe)"}</Label>
                <Input
                  value={open.buy_url || ""}
                  placeholder={isRec ? "https://…" : "https://buy.stripe.com/…"}
                  onChange={(e) => patch(open.id, { buy_url: e.target.value })}
                />
              </div>
            )}

            {isPack && (
              <div>
                <Label className="text-xs">Libros incluidos en el pack</Label>
                <div className="mt-1 space-y-1.5">
                  {books.filter((x) => (x.kind || "book") === "book").map((x) => {
                    const items: string[] = open.pack_items || [];
                    const on = items.includes(x.id);
                    return (
                      <label key={x.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            patch(open.id, { pack_items: on ? items.filter((i) => i !== x.id) : [...items, x.id] })
                          }
                        />
                        {x.title}
                      </label>
                    );
                  })}
                  {books.filter((x) => (x.kind || "book") === "book").length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Crea primero algún libro para poder incluirlo.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                {open.published ? <Globe className="w-4 h-4 text-success" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                {open.published ? "Publicado" : "Borrador privado"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {open.published
                  ? "Aparece en la página de recursos de tus clientes."
                  : "Solo lo ves tú. Nadie más puede abrirlo ni encontrarlo."}
              </p>
            </div>
            <Switch checked={open.published} onCheckedChange={(v) => patch(open.id, { published: v })} />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => save(open)} disabled={busy === open.id}>
              {busy === open.id ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="ghost" onClick={() => remove(open)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const items = books.filter((b) => (b.parent_id || null) === parentId);
  const countInside = (id: string) => books.filter((b) => b.parent_id === id).length;

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" /> Tu nube privada
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Todo tu contenido en un solo sitio: carpetas, libros, packs, vídeos y recomendaciones.
              Nada se ve fuera hasta que tú lo publicas.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" /> Nuevo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => create("folder")}>
                <FolderPlus className="w-4 h-4 mr-2" /> Carpeta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => create("book")}>
                <BookOpen className="w-4 h-4 mr-2" /> Libro (portada + PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => create("pack")}>
                <Package className="w-4 h-4 mr-2" /> Pack (elige libros)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Migas de pan */}
      <div className="flex items-center gap-1 text-sm overflow-x-auto">
        <button
          onClick={() => setPath([])}
          className={`px-2 py-1 rounded-md hover:bg-secondary ${path.length === 0 ? "font-semibold" : "text-muted-foreground"}`}
        >
          Drive
        </button>
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <button
              onClick={() => setPath((arr) => arr.slice(0, i + 1))}
              className={`px-2 py-1 rounded-md hover:bg-secondary ${i === path.length - 1 ? "font-semibold" : "text-muted-foreground"}`}
            >
              {p.title}
            </button>
          </span>
        ))}
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Esta carpeta está vacía. Pulsa «Nuevo» para empezar.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => {
          const kind: Kind = b.kind || (b.is_pack ? "pack" : b.is_folder ? "folder" : "book");
          if (kind === "folder") {
            return (
              <div
                key={b.id}
                className="bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors flex items-center gap-3"
              >
                <button onClick={() => setPath((p) => [...p, { id: b.id, title: b.title }])} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Folder className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{b.title}</p>
                    <p className="text-[11px] text-muted-foreground">{countInside(b.id)} elementos</p>
                  </div>
                </button>
                <button onClick={() => rename(b)} className="text-[11px] text-muted-foreground hover:text-foreground px-1">
                  Renombrar
                </button>
                <button onClick={() => remove(b)} className="p-1 rounded hover:bg-secondary">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            );
          }

          const packCover = kind === "pack" ? covers[(b.pack_items || [])[0]] : undefined;
          const thumb = covers[b.id] || packCover;
          const detail =
            kind === "book" ? `${b.file_path ? "PDF listo" : "Sin PDF"} · ${b.cover_path ? "con portada" : "sin portada"}`
            : kind === "pack" ? `${(b.pack_items || []).length} libros incluidos`
            : kind === "video" ? (b.video_url ? "Enlace añadido" : "Sin enlace")
            : b.buy_url ? "Enlace añadido" : "Sin enlace";

          return (
            <button
              key={b.id}
              onClick={() => setOpenId(b.id)}
              className="text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                {thumb ? (
                  <img src={thumb} alt="" className="w-14 h-[74px] rounded object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-[74px] rounded bg-secondary shrink-0 flex items-center justify-center">
                    {kind === "pack" ? <Package className="w-5 h-5 text-primary" />
                      : kind === "video" ? <Video className="w-5 h-5 text-primary" />
                      : kind === "recommendation" ? <Star className="w-5 h-5 text-primary" />
                      : <BookOpen className="w-5 h-5 text-muted-foreground" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{b.title || "Sin título"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{KIND_LABEL[kind]} · {detail}</p>
                  <span
                    className={`inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      b.published ? "text-success bg-success/10" : "text-muted-foreground bg-secondary"
                    }`}
                  >
                    {b.published ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                    {b.published ? "Publicado" : "Borrador"}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LibraryDrive;
