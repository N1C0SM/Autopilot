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
  Music,
  File as FileIcon,
} from "lucide-react";
import { toast } from "sonner";
import { toOptimizedWebp } from "@/shared/lib/imageOptimization";
import { ImageWithFallback, InlineBack, MONO_FIELD } from "@/app/components/admin/content/AdminContentParts";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { useTextPrompt } from "@/app/components/admin/content/useTextPrompt";

type Kind = "folder" | "book" | "pack" | "video" | "recommendation" | "file";

/** Cómo se muestra un archivo subido, a partir de su extensión. */
type MediaKind = "image" | "video" | "audio" | "pdf" | "other";

/** Límite por archivo del Drive (el mismo que el del bucket `library`). */
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

const extOf = (name: string) => (name.match(/\.([a-z0-9]{1,8})$/i)?.[1] || "").toLowerCase();

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif", "bmp", "svg"];
const VIDEO_EXT = ["mp4", "mov", "m4v", "webm", "ogv", "avi", "mkv"];
const AUDIO_EXT = ["mp3", "m4a", "wav", "aac", "ogg", "flac"];

const mediaKindOf = (path: string | null | undefined): MediaKind => {
  const ext = extOf(path || "");
  if (IMAGE_EXT.includes(ext)) return "image";
  if (VIDEO_EXT.includes(ext)) return "video";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "other";
};

const formatMb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Etiqueta corta del tipo de archivo ("Imagen", "Vídeo", "PDF", "ZIP"…). */
const mediaLabel = (path: string | null | undefined): string => {
  const kind = mediaKindOf(path);
  if (kind === "image") return "Imagen";
  if (kind === "video") return "Vídeo";
  if (kind === "audio") return "Audio";
  if (kind === "pdf") return "PDF";
  return extOf(path || "").toUpperCase() || "Archivo";
};

/** Rutas del almacén de un elemento, separadas por bucket (`site-assets` o `library`). */
const storagePathsOf = (items: Book[]) => {
  const library: string[] = [];
  const site: string[] = [];
  for (const b of items) {
    if (b.file_path) library.push(b.file_path);
    if (!b.cover_path) continue;
    if (b.cover_path.startsWith("http")) {
      const marker = "/site-assets/";
      const at = b.cover_path.indexOf(marker);
      if (at >= 0) site.push(decodeURIComponent(b.cover_path.slice(at + marker.length).split("?")[0]));
    } else {
      library.push(b.cover_path);
    }
  }
  return { library, site };
};

/**
 * Miniatura de un vídeo con la proporción real del archivo y su primer fotograma: un vídeo
 * vertical se ve vertical y uno horizontal, horizontal (`preload="metadata"`, sin descargarlo).
 * El `#t=0.1` y el pequeño «seek» hacen que el navegador pinte ese primer fotograma como
 * póster; sin ellos Safari y Chrome dejan el hueco en negro.
 */
const VideoThumb = ({ src }: { src: string }) => {
  const [ratio, setRatio] = useState<number | null>(null);
  const width = Math.min(Math.max(60 * (ratio ?? 0.75), 34), 107);
  const source = src.includes("#") ? src : `${src}#t=0.1`;
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[10px] bg-secondary" style={{ height: 60, width }}>
      <video
        src={source}
        preload="metadata"
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
          if (v.currentTime === 0) {
            try { v.currentTime = 0.1; } catch { /* algunos navegadores no dejan hasta tener datos */ }
          }
        }}
        className="h-full w-full object-cover"
      />
    </div>
  );
};


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
  file: "Archivo",
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
  /** Miniaturas de archivos que son imágenes o vídeos y no tienen portada propia. */
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  /** Modo selección para borrar varios elementos (o todo) de una vez. */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
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

  // Firmar portadas y archivos de imagen para poder verlos (el almacén es privado)
  useEffect(() => {
    (async () => {
      const coverEntries: Record<string, string> = {};
      const thumbEntries: Record<string, string> = {};
      for (const b of books) {
        const media = mediaKindOf(b.file_path);
        // Un vídeo siempre pide su archivo: su primer fotograma es la miniatura, tenga o no portada.
        if (media === "video" && b.file_path && !thumbs[b.id]) {
          const { data } = await supabase.storage.from("library").createSignedUrl(b.file_path, 3600);
          if (data?.signedUrl) thumbEntries[b.id] = data.signedUrl;
          continue;
        }
        if (b.cover_path && !covers[b.id]) {
          if (b.cover_path.startsWith("http")) coverEntries[b.id] = b.cover_path;
          else {
            const { data } = await supabase.storage.from("library").createSignedUrl(b.cover_path, 3600);
            if (data?.signedUrl) coverEntries[b.id] = data.signedUrl;
          }
          continue;
        }
        // Una imagen suelta se muestra como miniatura.
        if (media === "image" && b.file_path && !thumbs[b.id]) {
          const { data } = await supabase.storage.from("library").createSignedUrl(b.file_path, 3600);
          if (data?.signedUrl) thumbEntries[b.id] = data.signedUrl;
        }
      }
      if (Object.keys(coverEntries).length) setCovers((c) => ({ ...c, ...coverEntries }));
      if (Object.keys(thumbEntries).length) setThumbs((t) => ({ ...t, ...thumbEntries }));
    })();
  }, [books, covers, thumbs]);

  const create = async (kind: Kind) => {
    const title =
      kind === "pack" ? "Pack completo"
      : kind === "folder" ? "Nueva carpeta"
      : kind === "video" ? "Nuevo vídeo"
      : kind === "recommendation" ? "Nueva recomendación"
      : kind === "file" ? "Nuevo archivo"
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
    const title = await askText({ title: "Nombre", initialValue: b.title });
    if (!title) return;
    const { error } = await supabase.from("library_books").update({ title }).eq("id", b.id);
    if (error) { toast.error("No se pudo renombrar"); return; }
    patch(b.id, { title });
  };

  /** Un elemento y todo lo que cuelga de él (las subcarpetas se borran en cascada). */
  const withDescendants = (ids: string[]) => {
    const all = new Set(ids);
    let added = true;
    while (added) {
      added = false;
      for (const b of books) {
        if (b.parent_id && all.has(b.parent_id) && !all.has(b.id)) { all.add(b.id); added = true; }
      }
    }
    return [...all];
  };

  const removeMany = async (ids: string[]): Promise<boolean> => {
    const all = withDescendants(ids);
    const targets = books.filter((b) => all.includes(b.id));
    const { library, site } = storagePathsOf(targets);
    // Primero los archivos y después las filas: si algo falla, se ve el error en vez de
    // dejar elementos fantasma apuntando a archivos que ya no existen.
    if (library.length) {
      const { error } = await supabase.storage.from("library").remove(library);
      if (error) console.warn("No se pudieron borrar todos los archivos", error);
    }
    if (site.length) {
      const { error } = await supabase.storage.from("site-assets").remove(site);
      if (error) console.warn("No se pudieron borrar todas las portadas", error);
    }
    const { error } = await supabase.from("library_books").delete().in("id", all);
    if (error) {
      console.error("Could not delete Drive items", error);
      toast.error("No se pudo eliminar");
      return false;
    }
    setBooks((arr) => arr.filter((b) => !all.includes(b.id)));
    setOpenId(null);
    setSelected([]);
    setSelecting(false);
    toast.success(all.length === 1 ? "Eliminado" : `${all.length} elementos eliminados`);
    return true;
  };

  const remove = async (b: Book) => {
    const confirmed = await ask({
      title: `¿Eliminar «${b.title || "sin título"}»?`,
      description: b.kind === "folder" || b.is_folder
        ? "Se eliminará la carpeta con todo lo que contiene."
        : "Se eliminará el elemento y su archivo. No se puede deshacer.",
    });
    if (confirmed) await removeMany([b.id]);
  };

  const removeSelected = async () => {
    if (!selected.length) return;
    const confirmed = await ask({
      title: selected.length === 1 ? "¿Eliminar 1 elemento?" : `¿Eliminar ${selected.length} elementos?`,
      description: "Se eliminarán sus archivos. No se puede deshacer.",
    });
    if (confirmed) await removeMany(selected);
  };

  const upload = async (b: Book, kind: "cover" | "file", file: File) => {
    setBusy(b.id);
    try {
      if (kind === "cover" && !file.type.startsWith("image/")) {
        throw new Error("Selecciona una imagen para la portada");
      }
      // El Drive acepta cualquier tipo de archivo: imágenes, vídeos, PDF, EPUB, ZIP…
      // Solo se comprueba que no venga vacío ni se pase del límite del almacén.
      if (kind === "file" && file.size === 0) {
        throw new Error("El archivo está vacío");
      }
      if (kind === "file" && file.size > MAX_UPLOAD_BYTES) {
        throw new Error(`El archivo supera el límite de ${formatMb(MAX_UPLOAD_BYTES)}`);
      }
      const uploadFile = kind === "cover" ? await toOptimizedWebp(file) : file;
      const ext = extOf(uploadFile.name) || (kind === "cover" ? "webp" : "bin");
      const path = `${b.folder}/${kind === "cover" ? "portada" : "archivo"}-${Date.now()}.${ext}`;
      const bucket = kind === "cover" ? "site-assets" : "library";
      const finalPath = kind === "cover" ? `library-covers/${path}` : path;
      const { error } = await supabase.storage.from(bucket).upload(finalPath, uploadFile, {
        upsert: false,
        contentType: uploadFile.type || (kind === "cover" ? "image/webp" : "application/octet-stream"),
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
      toast.success(kind === "cover" ? "Portada reemplazada" : "Archivo subido correctamente");
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
  /** Proporción real del vídeo para que la vista previa respete su orientación. */
  const [videoRatio, setVideoRatio] = useState<number | null>(null);
  useEffect(() => {
    setPreviewUrl(null);
    setVideoRatio(null);
    if (!previewPath) return;
    let active = true;
    supabase.storage.from("library").createSignedUrl(previewPath, 1800).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.signedUrl) {
        toast.error("No se pudo cargar la vista previa del archivo");
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
    : k === "file" ? <FileIcon className={cls} strokeWidth={strokeWidth} />
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
    const isFile = kind === "file";
    const fileKind = mediaKindOf(open.file_path);
    const fileExt = extOf(open.file_path || "");
    const packBooks = books.filter((x) => (x.kind || "book") === "book");

    const fileLabel = isVideo ? "Vídeo (archivo)" : isFile ? "Archivo" : "Archivo del libro";
    const fileHint =
      fileKind === "image" ? "Imagen"
      : fileKind === "video" ? "Vídeo"
      : fileKind === "audio" ? "Audio"
      : fileKind === "pdf" ? "PDF"
      : fileExt ? fileExt.toUpperCase()
      : "Archivo";

    const renderPreview = () => {
      if (!open.file_path) {
        return (
          <div className={emptyPreview}>
            <FileText className="h-6 w-6" strokeWidth={1.75} /> Sin archivo
          </div>
        );
      }
      if (!previewUrl) {
        return (
          <div className={emptyPreview}>
            <Spinner size="md" label="Cargando contenido" /> Cargando contenido…
          </div>
        );
      }
      if (fileKind === "image") {
        return <img src={previewUrl} alt={open.title || "Archivo"} className="h-full w-full bg-secondary object-contain" />;
      }
      if (fileKind === "video") {
        return (
          <video
            // El `#t=0.1` pinta el primer fotograma como póster antes de darle a reproducir.
            src={previewUrl.includes("#") ? previewUrl : `${previewUrl}#t=0.1`}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setVideoRatio(v.videoWidth / v.videoHeight);
            }}
            className="h-full w-full bg-black object-contain"
          />
        );
      }
      if (fileKind === "audio") {
        return (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-secondary px-5">
            <Music className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} />
            <audio src={previewUrl} controls className="w-full" />
          </div>
        );
      }
      if (fileKind === "pdf") {
        return (
          <iframe
            loading="lazy"
            src={`${previewUrl}#page=2&toolbar=0&navpanes=0&view=FitH`}
            title="Vista previa del contenido del PDF"
            className="h-full w-full"
          />
        );
      }
      return (
        <div className={emptyPreview}>
          <FileIcon className="h-6 w-6" strokeWidth={1.75} />
          <span className="type-footnote text-muted-foreground">{fileHint}</span>
          <span className="type-caption1 text-muted-foreground">Ábrelo o descárgalo para verlo</span>
        </div>
      );
    };

    const fileSection = (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 px-4">
          <Label className="type-group-header">{fileLabel}</Label>
          <label className={uploadLink}>
            {open.file_path ? "Cambiar archivo" : "Subir archivo"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.currentTarget.value = "";
                if (f) upload(open, "file", f);
              }}
            />
          </label>
        </div>
        <div
          className={`${isVideo ? "relative w-full overflow-hidden rounded-2xl bg-card" : previewBox} ${isVideo && !videoRatio ? "aspect-video" : ""}`}
          style={isVideo && videoRatio ? { aspectRatio: String(videoRatio), maxHeight: "70vh" } : undefined}
        >
          {renderPreview()}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Opciones del archivo" className={menuButton}>
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {open.file_path && (
                <>
                  <DropdownMenuItem onClick={() => downloadFile(open.file_path!, `${open.title || "archivo"}.${fileExt || "bin"}`)}>
                    <Download className="mr-2 h-4 w-4" /> Descargar archivo
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
        {open.file_path && (
          <p className="px-4 pt-1 type-footnote text-muted-foreground">
            {fileHint} · {mediaKindOf(open.file_path) === "other" ? "Se descarga tal cual" : "Se puede ver aquí mismo"}
          </p>
        )}
      </div>
    );

    return (
      <div className="w-full space-y-8">
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

            {isBook && fileSection}
          </div>
        )}

        {(isFile || isVideo) && (
          <div className="sm:max-w-md">{fileSection}</div>
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

        {(isBook || isFile || isVideo) && open.file_path && (
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
                ? (isBook || isPack)
                  ? "Aparece en la página de recursos de tus clientes si está en la carpeta «Libros»."
                  : "Publicado: puedes compartirlo con su enlace de descarga."
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
  const allSelected = items.length > 0 && selected.length === items.length;

  return (
    <div className="w-full space-y-4">
      <p className="max-w-xl type-subhead text-muted-foreground">
        Todo tu contenido en un solo sitio: carpetas, libros, packs, vídeos y archivos de
        cualquier tipo (imágenes, vídeos, PDF, EPUB, ZIP…). Nada se ve fuera hasta que tú lo publicas.
      </p>

      {/* Barra de herramientas: ruta a la izquierda, acciones a la derecha */}
      <div className="flex items-center justify-between gap-2">
        <nav aria-label="Ruta" className="no-scrollbar -ml-2 flex min-w-0 flex-1 items-center overflow-x-auto type-subhead">
          <button
            onClick={() => { void hapticTap(); setPath([]); setSelected([]); }}
            className={`inline-flex min-h-[44px] shrink-0 items-center px-2 transition-opacity active:opacity-60 ${path.length === 0 ? "font-semibold" : "text-primary"}`}
          >
            Drive
          </button>
          {path.map((p, i) => (
            <span key={p.id} className="flex shrink-0 items-center">
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
              <button
                onClick={() => { void hapticTap(); setPath((arr) => arr.slice(0, i + 1)); setSelected([]); }}
                className={`inline-flex min-h-[44px] items-center px-2 transition-opacity active:opacity-60 ${i === path.length - 1 ? "font-semibold" : "text-primary"}`}
              >
                {p.title}
              </button>
            </span>
          ))}
        </nav>
        <div className="-mr-2 flex shrink-0 items-center">
          {selecting ? (
            <Button variant="plain" onClick={() => { void hapticTap(); setSelecting(false); setSelected([]); }}>
              Cancelar
            </Button>
          ) : (
            <>
              {items.length > 0 && (
                <Button variant="plain" onClick={() => { void hapticTap(); setSelected([]); setSelecting(true); }}>
                  Seleccionar
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="plain" onClick={() => void hapticTap()}>Nuevo</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => create("folder")}>
                    <FolderPlus className="mr-2 h-4 w-4" /> Carpeta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => create("book")}>
                    <BookOpen className="mr-2 h-4 w-4" /> Libro (portada + archivo)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => create("pack")}>
                    <Package className="mr-2 h-4 w-4" /> Pack (elige libros)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => create("video")}>
                    <Video className="mr-2 h-4 w-4" /> Vídeo (archivo o enlace)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => create("file")}>
                    <FileIcon className="mr-2 h-4 w-4" /> Archivo (imagen, vídeo, PDF…)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {selecting && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="plain"
            className="-ml-3"
            onClick={() => {
              void hapticTap();
              setSelected(allSelected ? [] : items.map((b) => b.id));
            }}
          >
            {allSelected ? "Ninguno" : "Todos"}
          </Button>
          <Button variant="destructive" disabled={selected.length === 0} onClick={() => void removeSelected()}>
            {selected.length ? `Eliminar (${selected.length})` : "Eliminar"}
          </Button>
        </div>
      )}

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
            const isSelected = selected.includes(b.id);
            const toggleSelect = () => {
              void hapticSelection();
              setSelected((s) => (s.includes(b.id) ? s.filter((x) => x !== b.id) : [...s, b.id]));
            };
            if (kind === "folder") {
              return (
                <ListRow
                  key={b.id}
                  icon={<Folder />}
                  title={b.title}
                  subtitle={`${countInside(b.id)} elementos`}
                  onClick={selecting ? toggleSelect : () => setPath((p) => [...p, { id: b.id, title: b.title }])}
                  trailing={
                    selecting ? (
                      <Checkbox checked={isSelected} onCheckedChange={toggleSelect} aria-label={`Seleccionar ${b.title || "la carpeta"}`} />
                    ) : (
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
                    )
                  }
                />
              );
            }

            const packCover = kind === "pack" ? covers[(b.pack_items || [])[0]] : undefined;
            const fileUrl = thumbs[b.id];
            // Un vídeo enseña siempre su primer fotograma: es lo que de verdad hay dentro.
            const videoFileUrl = mediaKindOf(b.file_path) === "video" ? fileUrl : undefined;
            const thumb = videoFileUrl ? undefined : covers[b.id] || packCover;
            const detail =
              kind === "book" ? `${b.file_path ? "Archivo listo" : "Sin archivo"} · ${b.cover_path ? "con portada" : "sin portada"}`
              : kind === "pack" ? `${(b.pack_items || []).length} libros incluidos`
              : kind === "file" ? (b.file_path ? mediaLabel(b.file_path) : "Sin archivo")
              : kind === "video" ? (b.file_path ? mediaLabel(b.file_path) : b.video_url ? "Enlace añadido" : "Sin contenido")
              : b.buy_url_test || b.buy_url_live || b.buy_url ? `Stripe ${b.buy_url_test ? "Test" : ""}${b.buy_url_test && b.buy_url_live ? " + " : ""}${b.buy_url_live ? "Live" : ""}`.trim() : "Sin enlace";

            // Con archivo propio, la miniatura es el archivo: un vídeo muestra su primer
            // fotograma con su proporción real (vertical se ve vertical).
            const leading = videoFileUrl ? (
              <VideoThumb src={videoFileUrl} />
            ) : thumb ? (
              <ImageWithFallback
                src={thumb}
                className="h-[60px] w-11 shrink-0 rounded-[10px] object-cover"
                fallback={
                  <div className="flex h-[60px] w-11 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
                    {kindIcon(kind)}
                  </div>
                }
              />
            ) : fileUrl ? (
              <ImageWithFallback
                src={fileUrl}
                className="h-[60px] w-11 shrink-0 rounded-[10px] object-cover"
                fallback={
                  <div className="flex h-[60px] w-11 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
                    {kindIcon(kind)}
                  </div>
                }
              />
            ) : (
              <div className="flex h-[60px] w-11 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
                {kindIcon(kind)}
              </div>
            );

            return (
              <ListRow
                key={b.id}
                leading={leading}
                title={b.title || "Sin título"}
                subtitle={`${KIND_LABEL[kind]} · ${detail}`}
                value={selecting ? undefined : b.published ? "Publicado" : "Borrador"}
                onClick={selecting ? toggleSelect : () => setOpenId(b.id)}
                trailing={
                  selecting ? (
                    <Checkbox checked={isSelected} onCheckedChange={toggleSelect} aria-label={`Seleccionar ${b.title || "el elemento"}`} />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 text-muted-foreground" aria-label={`Opciones de ${b.title || "el elemento"}`} onClick={() => void hapticTap()}>
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setOpenId(b.id)}>
                          <Eye className="mr-2 h-4 w-4" /> Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void rename(b)}>Renombrar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void remove(b)}>
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                }
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
