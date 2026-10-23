import { errorMessage } from "@/shared/lib/runtimeValues";
import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Upload,
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  Eye,
  Download,
  MoreVertical,
  MoreHorizontal,
  Link as LinkIcon,
  Package,
  Lock,
  Globe,
  BookOpen,
  Video,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { toOptimizedWebp } from "@/shared/lib/imageOptimization";
import { ImageWithFallback, InlineBack, MONO_FIELD } from "@/app/components/admin/content/AdminContentParts";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { useTextPrompt } from "@/app/components/admin/content/useTextPrompt";

type Kind = "folder" | "book" | "pack" | "video" | "recommendation";

interface Book {
  id: string;
  title: string;
  description: string;
  price: string;
  buy_url?: string | null;
  buy_url_test?: string | null;
  buy_url_live?: string | null;
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
  const { ask, dialog: confirmDialog } = useConfirm();
  const { ask: askText, dialog: promptDialog } = useTextPrompt();

  const parentId = path.length ? path[path.length - 1].id : null;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { error } = await supabase
      .from("library_books")
      .update({
        title: b.title,
        description: b.description,
        price: b.price,
        buy_url: b.buy_url?.trim() || null,
        buy_url_test: b.buy_url_test?.trim() || null,
        buy_url_live: b.buy_url_live?.trim() || null,
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
    const title = await askText({ title: "Nombre de la carpeta", initialValue: b.title });
    if (!title) return;
    await supabase.from("library_books").update({ title }).eq("id", b.id);
    patch(b.id, { title });
  };

  const remove = async (b: Book) => {
    if (!(await ask({ title: `¿Eliminar «${b.title || "sin título"}»?`, description: "Se eliminará con todo lo que contiene." }))) return;
    const paths = [b.cover_path, b.file_path].filter((x) => x && !x.startsWith("http")) as string[];
    if (paths.length) await supabase.storage.from("library").remove(paths);
    await supabase.from("library_books").delete().eq("id", b.id);
    setOpenId(null);
    toast.success("Eliminado");
    load();
  };

  const upload = async (b: Book, kind: "cover" | "file", file: File) => {
    setBusy(b.id);
    try {
      if (kind === "file" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Selecciona un archivo PDF");
      }
      if (kind === "file" && file.size === 0) {
        throw new Error("El PDF está vacío");
      }
      const uploadFile = kind === "cover" ? await toOptimizedWebp(file) : file;
      const ext = uploadFile.name.split(".").pop() || (kind === "cover" ? "webp" : "pdf");
      const path = `${b.folder}/${kind === "cover" ? "portada" : "libro"}-${Date.now()}.${ext}`;
      const bucket = kind === "cover" ? "site-assets" : "library";
      const finalPath = kind === "cover" ? `library-covers/${path}` : path;
      const { error } = await supabase.storage.from(bucket).upload(finalPath, uploadFile, {
        upsert: false,
        contentType: uploadFile.type || (kind === "cover" ? "image/webp" : "application/pdf"),
      });
      if (error) throw error;
      const old = kind === "cover" ? b.cover_path : b.file_path;
      const col = kind === "cover" ? "cover_path" : "file_path";
      const value = kind === "cover"
        ? supabase.storage.from("site-assets").getPublicUrl(finalPath).data.publicUrl
        : path;
      const { error: updateError } = await supabase
        .from("library_books")
        .update(kind === "cover" ? { cover_path: value } : { file_path: value })
        .eq("id", b.id);
      if (updateError) {
        await supabase.storage.from(bucket).remove([finalPath]);
        throw updateError;
      }
      if (old && !old.startsWith("http")) {
        const oldBucket = kind === "cover" ? "site-assets" : "library";
        const { error: removeError } = await supabase.storage.from(oldBucket).remove([old]);
        if (removeError) console.warn("New file saved, but old file could not be removed", removeError);
      }
      patch(b.id, { [col]: value } as Partial<Book>);
      if (kind === "cover") setCovers((c) => ({ ...c, [b.id]: value }));
      toast.success(kind === "cover" ? "Portada reemplazada" : "PDF reemplazado correctamente");
    } catch (err: unknown) {
      const message = err instanceof Error ? errorMessage(err) : "Error al subir el archivo";
      console.error("Library file upload failed", err);
      toast.error(message);
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

  const shareOnce = async (bookId: string) => {
    const { data, error } = await supabase.from("book_share_links").insert({ book_id: bookId }).select("token").single();
    if (error || !data?.token) { toast.error("No se pudo crear el enlace"); return; }
    const url = `https://autopilotplan.com/d/${data.token}`;
    try { await navigator.clipboard.writeText(url); toast.success("Enlace copiado: sirve para 1 descarga, caduca en 7 días"); }
    catch { void askText({ title: "Copia este enlace", description: "Sirve para 1 descarga.", initialValue: url, readOnly: true }); }
  };

  const openFile = async (p: string) => {
    const { data, error } = await supabase.storage.from("library").createSignedUrl(p, 600);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo abrir el archivo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const downloadFile = async (p: string, name: string) => {
    const { data, error } = await supabase.storage.from("library").createSignedUrl(p, 600, { download: name });
    if (error || !data?.signedUrl) { toast.error("No se pudo descargar"); return; }
    window.location.href = data.signedUrl;
  };

  const downloadUrl = async (url: string, name: string) => {
    try {
      const blob = await (await fetch(url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { window.open(url, "_blank", "noopener"); }
  };

  const previewPath = books.find((b) => b.id === openId)?.file_path || null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    setPreviewUrl(null);
    if (!previewPath) return;
    let active = true;
    supabase.storage.from("library").createSignedUrl(previewPath, 1800).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.signedUrl) {
        toast.error("No se pudo cargar la vista previa del PDF");
        return;
      }
      setPreviewUrl(data.signedUrl);
    });
    return () => {
      active = false;
    };
  }, [previewPath]);


  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 type-subhead text-muted-foreground">
        <Spinner size="md" label="Cargando tu biblioteca" /> Cargando tu biblioteca…
      </div>
    );
  }

  const open = books.find((b) => b.id === openId) || null;

  const kindIcon = (k: Kind, cls = "h-5 w-5", strokeWidth = 2) =>
    k === "pack" ? <Package className={cls} strokeWidth={strokeWidth} />
    : k === "video" ? <Video className={cls} strokeWidth={strokeWidth} />
    : k === "recommendation" ? <Star className={cls} strokeWidth={strokeWidth} />
    : k === "folder" ? <Folder className={cls} strokeWidth={strokeWidth} />
    : <BookOpen className={cls} strokeWidth={strokeWidth} />;

  const menuButton = "absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-secondary transition-colors active:bg-accent";
  const uploadLink = "inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 type-subhead text-primary transition-opacity active:opacity-60";
  const previewBox = "relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-card";
  const emptyPreview = "flex h-full w-full flex-col items-center justify-center gap-2 type-subhead text-muted-foreground";

  if (open) {
    const kind: Kind = open.kind || (open.is_pack ? "pack" : open.is_folder ? "folder" : "book");
    const isBook = kind === "book";
    const isPack = kind === "pack";
    const isVideo = kind === "video";
    const isRec = kind === "recommendation";
    const packBooks = books.filter((x) => (x.kind || "book") === "book");

    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <InlineBack label={path.length ? path[path.length - 1].title : "Atrás"} onClick={() => setOpenId(null)} />
          <div className="flex items-start gap-3.5">
            <span className="mt-1 text-primary">{kindIcon(kind, "h-7 w-7", 1.75)}</span>
            <div className="min-w-0">
              <h2 className="type-title2 break-words">{open.title || "Sin título"}</h2>
              <p className="type-subhead text-muted-foreground">{KIND_LABEL[kind]}</p>
            </div>
          </div>
        </div>

        {(isBook || isPack) && (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Portada */}
            <div className={`space-y-1 ${isPack ? "sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-sm" : ""}`}>
              <div className="flex items-center justify-between gap-2 px-4">
                <Label className="type-group-header">Portada</Label>
                <label className={uploadLink}>
                  {open.cover_path ? "Cambiar portada" : "Subir portada"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (f) upload(open, "cover", f);
                    }}
                  />
                </label>
              </div>
              <div className={previewBox}>
                <ImageWithFallback
                  src={covers[open.id]}
                  alt="Portada"
                  className="h-full w-full object-cover"
                  fallback={
                    <div className={emptyPreview}>
                      <ImageIcon className="h-6 w-6" strokeWidth={1.75} /> Sin portada
                    </div>
                  }
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button aria-label="Opciones de portada" className={menuButton}>
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {covers[open.id] && (
                      <DropdownMenuItem
                        onClick={() =>
                          downloadUrl(
                            covers[open.id],
                            `${open.title || "portada"}-portada.${(open.cover_path || "").split(".").pop()?.split("?")[0] || "jpg"}`,
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" /> Descargar portada
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <label className="flex w-full cursor-pointer items-center">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) upload(open, "cover", f);
                          }}
                        />
                        <Upload className="mr-2 h-4 w-4" /> {open.cover_path ? "Cambiar portada" : "Subir portada"}
                      </label>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isBook && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 px-4">
                  <Label className="type-group-header">Archivo del libro</Label>
                  <label className={uploadLink}>
                    {open.file_path ? "Cambiar PDF" : "Subir PDF"}
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (f) upload(open, "file", f);
                      }}
                    />
                  </label>
                </div>
                <div className={previewBox}>
                  {open.file_path ? (
                    previewUrl ? (
                      <iframe
                        loading="lazy"
                        src={`${previewUrl}#page=2&toolbar=0&navpanes=0&view=FitH`}
                        title="Vista previa del contenido del PDF"
                        className="h-full w-full"
                      />
                    ) : (
                      <div className={emptyPreview}>
                        <Spinner size="md" label="Cargando contenido" /> Cargando contenido…
                      </div>
                    )
                  ) : (
                    <div className={emptyPreview}>
                      <FileText className="h-6 w-6" strokeWidth={1.75} /> Sin archivo
                    </div>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Opciones del archivo" className={menuButton}>
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {open.file_path && (
                        <>
                          <DropdownMenuItem onClick={() => downloadFile(open.file_path!, `${open.title || "libro"}.pdf`)}>
                            <Download className="mr-2 h-4 w-4" /> Descargar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => shareOnce(open.id)}>
                            <LinkIcon className="mr-2 h-4 w-4" /> Copiar enlace de 1 descarga
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openFile(open.file_path!)}>
                            <Eye className="mr-2 h-4 w-4" /> Abrir a pantalla completa
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem asChild>
                        <label className="flex w-full cursor-pointer items-center">
                          <input
                            type="file"
                            accept="application/pdf,application/zip,application/epub+zip"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.currentTarget.value = "";
                              if (f) upload(open, "file", f);
                            }}
                          />
                          <Upload className="mr-2 h-4 w-4" /> {open.file_path ? "Reemplazar archivo" : "Subir archivo"}
                        </label>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-muted-foreground">Título</Label>
            <Input enterKeyHint="next" value={open.title} onChange={(e) => patch(open.id, { title: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-muted-foreground">Descripción</Label>
            <Textarea
              rows={3}
              value={open.description}
              placeholder={isVideo ? "Qué se explica en el vídeo" : "De qué trata y a quién le sirve"}
              onChange={(e) => patch(open.id, { description: e.target.value })}
            />
          </div>

          {isVideo && (
            <div>
              <Label className="mb-1.5 block text-muted-foreground">Enlace del vídeo (YouTube, Vimeo…)</Label>
              <Input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={MONO_FIELD}
                enterKeyHint="done"
                value={open.video_url || ""}
                placeholder="https://…"
                onChange={(e) => patch(open.id, { video_url: e.target.value })}
              />
            </div>
          )}

          {(isBook || isPack) && (
            <div className="sm:max-w-[240px]">
              <Label className="mb-1.5 block text-muted-foreground">Precio</Label>
              <Input
                enterKeyHint="done"
                value={open.price}
                placeholder="Gratis, 19 €…"
                onChange={(e) => patch(open.id, { price: e.target.value })}
              />
              <Button type="button" variant="plain" className="-ml-3 min-h-[44px]" disabled={busy === "price"} onClick={() => { void hapticTap(); void suggestPrice(open); }}>
                {busy === "price" && <Spinner size="sm" />} Sugerir precio con IA
              </Button>
              {priceTip && <p className="mt-1 type-footnote text-muted-foreground">{priceTip}</p>}
            </div>
          )}

          {isRec && (
            <div>
              <Label className="mb-1.5 block text-muted-foreground">Enlace de la recomendación</Label>
              <Input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={MONO_FIELD}
                enterKeyHint="done"
                value={open.buy_url || ""}
                placeholder="https://…"
                onChange={(e) => patch(open.id, { buy_url: e.target.value })}
              />
            </div>
          )}

          {(isBook || isPack) && (
            <p className="type-footnote text-muted-foreground">
              Los enlaces de compra se gestionan en Ajustes → Pagos.
            </p>
          )}
        </div>

        {isPack && packBooks.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="Aún no hay libros"
            description="Crea primero algún libro para poder incluirlo."
            className="py-6"
          />
        )}

        {isPack && packBooks.length > 0 && (
          <ListGroup
            header="Libros incluidos en el pack"
            footer="El cliente podrá descargar cada libro incluido una sola vez. Caduca en 7 días."
          >
            {packBooks.map((x) => {
              const items: string[] = open.pack_items || [];
              const on = items.includes(x.id);
              const toggle = () => {
                void hapticSelection();
                patch(open.id, { pack_items: on ? items.filter((i) => i !== x.id) : [...items, x.id] });
              };
              return (
                <ListRow
                  key={x.id}
                  title={x.title}
                  trailing={<Checkbox checked={on} onCheckedChange={toggle} aria-label={x.title} />}
                  onClick={toggle}
                />
              );
            })}
          </ListGroup>
        )}

        {isPack && (
          <Button
            variant="tinted"
            className="w-full sm:w-auto"
            disabled={(open.pack_items || []).length === 0}
            onClick={() => { void hapticTap(); shareOnce(open.id); }}
          >
            Copiar enlace de 1 descarga del pack
          </Button>
        )}

        {isBook && open.file_path && (
          <div className="space-y-1.5">
            <Button variant="tinted" className="w-full sm:w-auto" onClick={() => { void hapticTap(); shareOnce(open.id); }}>
              Copiar enlace de 1 descarga
            </Button>
            <p className="type-footnote text-muted-foreground">El cliente podrá descargarlo una sola vez. Caduca en 7 días.</p>
          </div>
        )}

        <ListGroup>
          <ListRow
            icon={open.published ? <Globe className="text-success" /> : <Lock className="text-muted-foreground" />}
            title={open.published ? "Publicado" : "Borrador privado"}
            subtitle={
              open.published
                ? "Aparece en la página de recursos de tus clientes."
                : "Solo lo ves tú. Nadie más puede abrirlo ni encontrarlo."
            }
            trailing={<Switch checked={open.published} onCheckedChange={(v) => { void hapticSelection(); patch(open.id, { published: v }); }} />}
          />
        </ListGroup>

        <div className="space-y-2">
          <Button size="lg" className="w-full md:w-auto" onClick={() => { void hapticTap(); void save(open); }} disabled={busy === open.id}>
            {busy === open.id ? "Guardando…" : "Guardar"}
          </Button>
          <div>
            <Button variant="plain" className="-ml-4 text-destructive" aria-label={`Eliminar ${open.title || "elemento"}`} onClick={() => { void remove(open); }}>
              Eliminar
            </Button>
          </div>
        </div>
        {confirmDialog}
        {promptDialog}
      </div>
    );
  }

  const items = books.filter((b) => (b.parent_id || null) === parentId);
  const countInside = (id: string) => books.filter((b) => b.parent_id === id).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="max-w-xl type-subhead text-muted-foreground">
        Todo tu contenido en un solo sitio: carpetas, libros, packs, vídeos y recomendaciones.
        Nada se ve fuera hasta que tú lo publicas.
      </p>

      {/* Barra de herramientas: ruta a la izquierda, acciones a la derecha */}
      <div className="flex items-center justify-between gap-2">
        <nav aria-label="Ruta" className="no-scrollbar -ml-2 flex min-w-0 flex-1 items-center overflow-x-auto type-subhead">
          <button
            onClick={() => { void hapticTap(); setPath([]); }}
            className={`inline-flex min-h-[44px] shrink-0 items-center px-2 transition-opacity active:opacity-60 ${path.length === 0 ? "font-semibold" : "text-primary"}`}
          >
            Drive
          </button>
          {path.map((p, i) => (
            <span key={p.id} className="flex shrink-0 items-center">
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
              <button
                onClick={() => { void hapticTap(); setPath((arr) => arr.slice(0, i + 1)); }}
                className={`inline-flex min-h-[44px] items-center px-2 transition-opacity active:opacity-60 ${i === path.length - 1 ? "font-semibold" : "text-primary"}`}
              >
                {p.title}
              </button>
            </span>
          ))}
        </nav>
        <div className="-mr-2 flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="plain" onClick={() => void hapticTap()}>Nuevo</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => create("folder")}>
                <FolderPlus className="mr-2 h-4 w-4" /> Carpeta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => create("book")}>
                <BookOpen className="mr-2 h-4 w-4" /> Libro (portada + PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => create("pack")}>
                <Package className="mr-2 h-4 w-4" /> Pack (elige libros)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Esta carpeta está vacía"
          description="Pulsa «Nuevo» para empezar."
        />
      ) : (
        <ListGroup>
          {items.map((b) => {
            const kind: Kind = b.kind || (b.is_pack ? "pack" : b.is_folder ? "folder" : "book");
            if (kind === "folder") {
              return (
                <ListRow
                  key={b.id}
                  icon={<Folder />}
                  title={b.title}
                  subtitle={`${countInside(b.id)} elementos`}
                  onClick={() => setPath((p) => [...p, { id: b.id, title: b.title }])}
                  trailing={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 text-muted-foreground" aria-label={`Opciones de ${b.title || "la carpeta"}`} onClick={() => void hapticTap()}>
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => void rename(b)}>Renombrar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void remove(b)}>
                          Eliminar carpeta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              );
            }

            const packCover = kind === "pack" ? covers[(b.pack_items || [])[0]] : undefined;
            const thumb = covers[b.id] || packCover;
            const detail =
              kind === "book" ? `${b.file_path ? "PDF listo" : "Sin PDF"} · ${b.cover_path ? "con portada" : "sin portada"}`
              : kind === "pack" ? `${(b.pack_items || []).length} libros incluidos`
              : kind === "video" ? (b.video_url ? "Enlace añadido" : "Sin enlace")
              : b.buy_url_test || b.buy_url_live || b.buy_url ? `Stripe ${b.buy_url_test ? "Test" : ""}${b.buy_url_test && b.buy_url_live ? " + " : ""}${b.buy_url_live ? "Live" : ""}`.trim() : "Sin enlace";

            return (
              <ListRow
                key={b.id}
                leading={
                  <ImageWithFallback
                    src={thumb}
                    className="h-[60px] w-11 shrink-0 rounded-[10px] object-cover"
                    fallback={
                      <div className="flex h-[60px] w-11 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
                        {kindIcon(kind)}
                      </div>
                    }
                  />
                }
                title={b.title || "Sin título"}
                subtitle={`${KIND_LABEL[kind]} · ${detail}`}
                value={b.published ? "Publicado" : "Borrador"}
                chevron
                onClick={() => setOpenId(b.id)}
              />
            );
          })}
        </ListGroup>
      )}
      {confirmDialog}
      {promptDialog}
    </div>
  );
};

export default LibraryDrive;
