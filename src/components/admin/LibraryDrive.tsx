import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  ArrowLeft,
  Eye,
  Package,
  Lock,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

interface Book {
  id: string;
  title: string;
  description: string;
  price: string;
  folder: string;
  cover_path: string | null;
  file_path: string | null;
  is_pack: boolean;
  published: boolean;
  sort_order: number;
}

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

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("library_books")
      .select("*")
      .order("is_pack", { ascending: false })
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
        const { data } = await supabase.storage.from("library").createSignedUrl(b.cover_path!, 3600);
        if (data?.signedUrl) entries[b.id] = data.signedUrl;
      }
      if (Object.keys(entries).length) setCovers((c) => ({ ...c, ...entries }));
    })();
  }, [books]);

  const addBook = async (isPack: boolean) => {
    const title = isPack ? "Pack completo" : "Nuevo libro";
    const folder = isPack ? "pack-completo" : slugify(`libro-${books.length + 1}`);
    const { data, error } = await (supabase as any)
      .from("library_books")
      .insert({ title, folder, is_pack: isPack, sort_order: books.length })
      .select()
      .single();
    if (error) {
      toast.error("No se pudo crear la carpeta");
      return;
    }
    setBooks((b) => [...b, data as Book]);
    setOpenId((data as Book).id);
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
        published: b.published,
      })
      .eq("id", b.id);
    setBusy(null);
    if (error) toast.error("No se pudo guardar");
    else toast.success("Guardado");
  };

  const remove = async (b: Book) => {
    if (!confirm(`¿Eliminar la carpeta "${b.title}" y sus archivos?`)) return;
    const paths = [b.cover_path, b.file_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("library").remove(paths);
    await (supabase as any).from("library_books").delete().eq("id", b.id);
    setBooks((arr) => arr.filter((x) => x.id !== b.id));
    setOpenId(null);
    toast.success("Carpeta eliminada");
  };

  const upload = async (b: Book, kind: "cover" | "file", file: File) => {
    setBusy(b.id);
    try {
      const ext = file.name.split(".").pop() || (kind === "cover" ? "jpg" : "pdf");
      const path = `${b.folder}/${kind === "cover" ? "portada" : "libro"}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("library").upload(path, file, {
        upsert: false,
        contentType: file.type || (kind === "cover" ? "image/jpeg" : "application/pdf"),
      });
      if (error) throw error;
      const old = kind === "cover" ? b.cover_path : b.file_path;
      if (old) await supabase.storage.from("library").remove([old]);
      const col = kind === "cover" ? "cover_path" : "file_path";
      await (supabase as any).from("library_books").update({ [col]: path }).eq("id", b.id);
      patch(b.id, { [col]: path } as Partial<Book>);
      if (kind === "cover") {
        const { data } = await supabase.storage.from("library").createSignedUrl(path, 3600);
        if (data?.signedUrl) setCovers((c) => ({ ...c, [b.id]: data.signedUrl }));
      }
      toast.success(kind === "cover" ? "Portada subida" : "Libro subido");
    } catch (err: any) {
      toast.error(err.message || "Error al subir");
    } finally {
      setBusy(null);
    }
  };

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("library").createSignedUrl(path, 600);
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
    return (
      <div className="space-y-5">
        <button
          onClick={() => setOpenId(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Todas las carpetas
        </button>

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold">{open.title || "Sin título"}</h2>
            {open.is_pack && (
              <span className="text-[10px] uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Pack
              </span>
            )}
          </div>

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
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {open.is_pack ? "Archivo del pack" : "Archivo del libro"}
              </Label>
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
                placeholder="De qué trata y a quién le sirve"
                onChange={(e) => patch(open.id, { description: e.target.value })}
              />
            </div>
            <div className="sm:max-w-[200px]">
              <Label className="text-xs">Precio</Label>
              <Input
                value={open.price}
                placeholder="Gratis, 19 €…"
                onChange={(e) => patch(open.id, { price: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                {open.published ? <Globe className="w-4 h-4 text-success" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                {open.published ? "Publicado" : "Borrador privado"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {open.published
                  ? "Visible para tus clientes."
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

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" /> Tu nube privada
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Una carpeta por libro con su portada y su archivo, más la carpeta del pack completo. Todo
              queda guardado en privado hasta que tú lo publiques.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => addBook(true)}>
              <Package className="w-4 h-4 mr-1" /> Pack completo
            </Button>
            <Button size="sm" onClick={() => addBook(false)}>
              <Plus className="w-4 h-4 mr-1" /> Nueva carpeta
            </Button>
          </div>
        </div>
      </div>

      {books.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aún no tienes carpetas. Crea la primera con "Nueva carpeta".
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((b) => (
          <button
            key={b.id}
            onClick={() => setOpenId(b.id)}
            className="text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              {covers[b.id] ? (
                <img src={covers[b.id]} alt="" className="w-14 h-[74px] rounded object-cover shrink-0" />
              ) : (
                <div className="w-14 h-[74px] rounded bg-secondary shrink-0 flex items-center justify-center">
                  {b.is_pack ? <Package className="w-5 h-5 text-primary" /> : <Folder className="w-5 h-5 text-muted-foreground" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{b.title || "Sin título"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {b.file_path ? "Archivo listo" : "Sin archivo"} · {b.cover_path ? "con portada" : "sin portada"}
                </p>
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
        ))}
      </div>
    </div>
  );
};

export default LibraryDrive;
