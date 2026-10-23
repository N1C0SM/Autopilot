import { errorMessage, jsonObject, jsonString } from "@/shared/lib/runtimeValues";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import { cn } from "@/shared/lib/utils";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Trash2, Star, Film, BookOpen, Sparkles, User, ArrowUp, ArrowDown, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/shared/components/ui/spinner";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { toOptimizedWebp } from "@/shared/lib/imageOptimization";
import { ImageWithFallback, MONO_FIELD } from "@/app/components/admin/content/AdminContentParts";
import { useConfirm } from "@/app/components/admin/content/useConfirm";

interface Testimonial {
  id: string;
  name: string;
  result: string;
  text: string;
  photo_url: string | null;
  photo_before_url: string | null;
  photo_after_url: string | null;
  sort_order: number;
  visible: boolean;
  is_12w_transformation?: boolean;
}

interface Ebook {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  url: string;
  price: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  image_url: string;
  url: string;
  badge: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const AI_KEYS = [
  { key: "OPENAI_API_KEY", label: "OpenAI (ChatGPT)", desc: "Vídeos, imágenes, blog, libros y el resto de la IA con tu cuenta de OpenAI.", placeholder: "sk-..." },
  { key: "ANTHROPIC_API_KEY", label: "Claude (Anthropic)", desc: "Segunda opción para el texto si OpenAI se queda sin saldo.", placeholder: "sk-ant-..." },
  { key: "DEEPSEEK_API_KEY", label: "DeepSeek", desc: "Solo texto (planes, blog, chat, clasificación), mucho más barato. No genera imágenes ni vídeos: para eso sigue haciendo falta OpenAI.", placeholder: "sk-..." },
] as const;


const TEXT_PROVIDERS = [
  { id: "openai", label: "OpenAI", desc: "Texto, imágenes y vídeo" },
  { id: "anthropic", label: "Claude", desc: "Solo texto" },
  { id: "deepseek", label: "DeepSeek", desc: "Solo texto, muy barato" },
  { id: "lovable", label: "Lovable", desc: "Incluida, sin clave" },
] as const;

const IMAGE_ENGINES = [
  { id: "auto", label: "Automático", desc: "Sigue el orden del motor de texto (se salta las que no hacen imágenes)." },
  { id: "openai", label: "OpenAI", desc: "Siempre tu cuenta de OpenAI; si falla, Lovable de respaldo." },
  { id: "lovable", label: "Lovable", desc: "Siempre los créditos de Lovable." },
] as const;

const URL_INPUT = { inputMode: "url", autoCapitalize: "none", autoCorrect: "off", spellCheck: false } as const;
const FIELD_LABEL = "mb-1.5 block text-muted-foreground";
const UPLOAD_CHIP = "pressable inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 type-body";
const BLOCK = "space-y-3 p-4 [&:not(:last-child)]:sep-b";

const Section = ({ title, description, action, children }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) => (
  <section className="space-y-4">
    <div className="space-y-1">
      <SectionHeader title={title} size="md" action={action} />
      {description ? <p className="type-subhead text-muted-foreground">{description}</p> : null}
    </div>
    {children}
  </section>
);

const uploadImage = async (file: File, folder: string) => {
  const optimized = await toOptimizedWebp(file);
  const ext = optimized.name.split(".").pop() || "webp";
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("site-assets").upload(path, optimized, {
    upsert: false,
    contentType: optimized.type || "image/webp",
  });
  if (error) throw error;
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
};

const SiteContentEditor = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trainer, setTrainer] = useState({ trainer_name: "", trainer_photo_url: "", trainer_bio: "", contact_phone: "" });
  const [hero, setHero] = useState({ hero_video_url: "", hero_video_poster_url: "" });
  const [stores, setStores] = useState({ app_store_url: "", play_store_url: "" });
  const [showAppDownload, setShowAppDownload] = useState(true);
  const [transformationSlots, setTransformationSlots] = useState(10);
  const [videoUploading, setVideoUploading] = useState(false);
  const [posterUploading, setPosterUploading] = useState(false);
  const [settingsId, setSettingsId] = useState<string>("");
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [sections, setSections] = useState({ show_blog: true, show_ebooks: false, show_recommendations: false });
  const [landingCounts, setLandingCounts] = useState({ landing_ebooks_count: 4, landing_recommendations_count: 3 });
  const [ranking, setRanking] = useState(false);
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [guideEbookUrl, setGuideEbookUrl] = useState<string>("");
  const [aiKeys, setAiKeys] = useState<Record<string, string>>({});
  const { ask, dialog: confirmDialog } = useConfirm();

  const loadAiKeys = async () => {
    const { data } = await supabase.from("app_secrets").select("key, value");
    if (data) setAiKeys(Object.fromEntries(data.map((r) => [r.key, r.value])));
  };

  const saveAiKey = async (key: string) => {
    const value = (aiKeys[key] || "").trim();
    if (!value) { toast.error("Pega la clave primero"); return; }
    setSaving(true);
    const { error } = await supabase.from("app_secrets").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) toast.error("Error al guardar la clave"); else toast.success("Clave guardada");
    setSaving(false);
  };

  const removeAiKey = async (key: string) => {
    const { error } = await supabase.from("app_secrets").delete().eq("key", key);
    if (error) toast.error("Error al borrar"); else { setAiKeys((p) => ({ ...p, [key]: "" })); toast.success("Clave eliminada"); }
  };

  const saveAiSetting = async (key: string, value: string, okMsg?: string) => {
    setAiKeys((p) => ({ ...p, [key]: value }));
    const { error } = await supabase.from("app_secrets").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) toast.error("No se pudo guardar"); else if (okMsg) toast.success(okMsg);
  };

  // Motor de texto: orden libre y activación por proveedor
  const textProviderIds = TEXT_PROVIDERS.map((p) => p.id) as string[];
  const savedTextOrder = (aiKeys.AI_TEXT_ORDER || "").split(",").map((s) => s.trim()).filter((s) => textProviderIds.includes(s));
  const textDisplay = [...savedTextOrder, ...textProviderIds.filter((id) => !savedTextOrder.includes(id))];
  const textEnabled = new Set(aiKeys.AI_TEXT_ORDER ? savedTextOrder : textProviderIds);

  const saveTextOrder = (display: string[], enabled: Set<string>) =>
    saveAiSetting("AI_TEXT_ORDER", display.filter((id) => enabled.has(id)).join(","), "Orden de IA guardado");

  const moveTextProvider = (id: string, dir: -1 | 1) => {
    const i = textDisplay.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= textDisplay.length) return;
    const next = [...textDisplay];
    [next[i], next[j]] = [next[j], next[i]];
    saveTextOrder(next, textEnabled);
  };

  const toggleTextProvider = (id: string, on: boolean) => {
    const next = new Set(textEnabled);
    if (on) next.add(id); else next.delete(id);
    if (next.size === 0) { toast.error("Deja al menos una IA activa"); return; }
    saveTextOrder(textDisplay, next);
  };


  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: t }] = await Promise.all([
      supabase.from("settings").select("id, trainer_name, trainer_photo_url, trainer_bio, contact_phone, hero_video_url, hero_video_poster_url, app_store_url, play_store_url, show_app_download, transformation_slots, show_blog, show_ebooks, show_recommendations, ebooks, recommendations, guide_ebook_url, landing_ebooks_count, landing_recommendations_count").limit(1).maybeSingle(),
      supabase.from("site_testimonials").select("*").order("sort_order"),
    ]);
    if (s) {
      setSettingsId(s.id);
      setTrainer({
        trainer_name: s.trainer_name || "Nicolás",
        trainer_photo_url: s.trainer_photo_url || "",
        trainer_bio: s.trainer_bio || "",
        contact_phone: s.contact_phone || "",
      });
      setHero({
        hero_video_url: s.hero_video_url || "",
        hero_video_poster_url: s.hero_video_poster_url || "",
      });
      setStores({
        app_store_url: s.app_store_url || "",
        play_store_url: s.play_store_url || "",
      });
      setShowAppDownload(s.show_app_download ?? true);
      setTransformationSlots(Math.max(0, Number(s.transformation_slots ?? 10)));
      setSections({
        show_blog: s.show_blog ?? true,
        show_ebooks: s.show_ebooks ?? false,
        show_recommendations: s.show_recommendations ?? false,
      });
      setLandingCounts({
        landing_ebooks_count: Math.max(0, Number(s.landing_ebooks_count ?? 4)),
        landing_recommendations_count: Math.max(0, Number(s.landing_recommendations_count ?? 3)),
      });
      const rawEbooks = Array.isArray(s.ebooks) ? s.ebooks : [];
      setEbooks(rawEbooks.map(jsonObject).map((e) => ({
        id: jsonString(e.id) || uid(),
        title: jsonString(e.title) || "",
        description: jsonString(e.description) || "",
        cover_url: jsonString(e.cover_url) || "",
        url: jsonString(e.url) || "",
        price: jsonString(e.price) || "",
      })));
      const rawRecs = Array.isArray(s.recommendations) ? s.recommendations : [];
      setRecommendations(rawRecs.map(jsonObject).map((r) => ({
        id: jsonString(r.id) || uid(),
        title: jsonString(r.title) || "",
        description: jsonString(r.description) || "",
        image_url: jsonString(r.image_url) || "",
        url: jsonString(r.url) || "",
        badge: jsonString(r.badge) || "",
      })));
      setGuideEbookUrl((s.guide_ebook_url as string) || "");
    }
    if (t) setTestimonials(t as Testimonial[]);
    setLoading(false);
  };
  useEffect(() => { load(); loadAiKeys(); }, []);

  const saveSectionsToggles = async (next: typeof sections) => {
    setSections(next);
    const { error } = await supabase.from("settings").update(next).eq("id", settingsId);
    if (error) toast.error("Error al guardar"); else toast.success("Secciones actualizadas");
  };

  const saveLandingCounts = async (next: typeof landingCounts) => {
    setLandingCounts(next);
    const { error } = await supabase.from("settings").update(next).eq("id", settingsId);
    if (error) toast.error("Error al guardar"); else toast.success("Cantidades actualizadas");
  };

  const rankWithAi = async () => {
    setRanking(true);
    try {
      const { data: books } = await supabase
        .from("library_books")
        .select("id, title, description, price, is_pack")
        .eq("published", true)
        .eq("is_folder", false)
        .order("sort_order", { ascending: true });
      const { data, error } = await supabase.functions.invoke("rank-library", {
        body: { books: books || [], recommendations },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const bookIds: string[] = data.book_ids || [];
      await Promise.all(bookIds.map((id, i) =>
        supabase.from("library_books").update({ sort_order: i + 1 }).eq("id", id)
      ));

      const recoIds: string[] = data.recommendation_ids || [];
      if (recoIds.length > 0) {
        const byId = new Map(recommendations.map((r) => [r.id, r]));
        const ordered = recoIds.map((id) => byId.get(id)).filter(Boolean) as Recommendation[];
        const rest = recommendations.filter((r) => !recoIds.includes(r.id));
        const next = [...ordered, ...rest];
        setRecommendations(next);
        await supabase.from("settings").update({ recommendations: next.map(item => ({ ...item })) }).eq("id", settingsId);
      }
      toast.success(data.reason ? `Ordenado: ${data.reason}` : "Orden actualizado con IA");
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "No se pudo ordenar con IA");
    }
    setRanking(false);
  };

  const saveEbooks = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({ ebooks: ebooks.map(item => ({ ...item })) }).eq("id", settingsId);
    if (error) toast.error("Error al guardar"); else toast.success("Ebooks guardados");
    setSaving(false);
  };

  const saveRecommendations = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({ recommendations: recommendations.map(item => ({ ...item })) }).eq("id", settingsId);
    if (error) toast.error("Error al guardar"); else toast.success("Recomendaciones guardadas");
    setSaving(false);
  };

  const saveGuideEbookUrl = async () => {
    setSaving(true);
    const clean = guideEbookUrl.trim();
    if (clean && !/^https?:\/\//i.test(clean)) {
      toast.error("La URL debe empezar por http(s)://");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("settings").update({ guide_ebook_url: clean }).eq("id", settingsId);
    if (error) toast.error("Error al guardar"); else toast.success("Link de la guía actualizado");
    setSaving(false);
  };

  const onEbookCover = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "ebooks");
      setEbooks((arr) => arr.map((x) => x.id === id ? { ...x, cover_url: url } : x));
    } catch (err: unknown) { toast.error(errorMessage(err)); }
  };

  const onRecImage = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "recommendations");
      setRecommendations((arr) => arr.map((x) => x.id === id ? { ...x, image_url: url } : x));
    } catch (err: unknown) { toast.error(errorMessage(err)); }
  };

  const saveTrainer = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update(trainer).eq("id", settingsId);
    if (error) toast.error("Error al guardar"); else toast.success("Entrenador actualizado");
    setSaving(false);
  };

  const saveHero = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update(hero).eq("id", settingsId);
    if (error) toast.error("Error al guardar"); else toast.success("Vídeo del hero actualizado");
    setSaving(false);
  };

  const saveStores = async () => {
    setSaving(true);
    const clean = {
      app_store_url: stores.app_store_url.trim(),
      play_store_url: stores.play_store_url.trim(),
    };
    const isValid = (u: string) => !u || /^https?:\/\//i.test(u);
    if (!isValid(clean.app_store_url) || !isValid(clean.play_store_url)) {
      toast.error("Las URLs deben empezar por http(s)://");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("settings").update(clean).eq("id", settingsId);
    if (error) toast.error("Error al guardar");
    else {
      setStores(clean);
      toast.success("Enlaces de la app actualizados");
    }
    setSaving(false);
  };

  const toggleAppDownload = async (v: boolean) => {
    setShowAppDownload(v);
    const { error } = await supabase.from("settings").update({ show_app_download: v }).eq("id", settingsId);
    if (error) { setShowAppDownload(!v); toast.error("Error al guardar"); }
    else toast.success(v ? "Acceso a la app visible en la web" : "Acceso a la app oculto");
  };

  const saveTransformationSlots = async () => {
    const slots = Math.max(0, Math.min(999, Math.round(transformationSlots)));
    setSaving(true);
    const { error } = await supabase.from("settings").update({ transformation_slots: slots }).eq("id", settingsId);
    if (error) toast.error("Error al guardar las plazas");
    else {
      setTransformationSlots(slots);
      toast.success("Plazas de Transformación actualizadas");
    }
    setSaving(false);
  };

  const onHeroVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error("El vídeo debe pesar menos de 100 MB");
      return;
    }
    setVideoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `hero/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, {
        upsert: false,
        contentType: file.type || "video/mp4",
      });
      if (error) throw error;
      const url = supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
      const next = { ...hero, hero_video_url: url };
      setHero(next);
      await supabase.from("settings").update(next).eq("id", settingsId);
      toast.success("Vídeo subido y publicado");
    } catch (err: unknown) {
      toast.error(errorMessage(err) || "Error subiendo vídeo");
    } finally {
      setVideoUploading(false);
    }
  };

  const onHeroPoster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPosterUploading(true);
    try {
      const url = await uploadImage(file, "hero");
      const next = { ...hero, hero_video_poster_url: url };
      setHero(next);
      await supabase.from("settings").update(next).eq("id", settingsId);
      toast.success("Miniatura actualizada");
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    } finally {
      setPosterUploading(false);
    }
  };

  const removeHeroVideo = async () => {
    if (!(await ask({ title: "¿Quitar el vídeo del hero?", description: "La portada se mostrará sin reproductor.", confirmLabel: "Quitar" }))) return;
    const next = { hero_video_url: "", hero_video_poster_url: "" };
    setHero(next);
    await supabase.from("settings").update(next).eq("id", settingsId);
    toast.success("Vídeo eliminado del hero");
  };

  const onTrainerPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "trainer");
      setTrainer((t) => ({ ...t, trainer_photo_url: url }));
      toast.success("Foto subida");
    } catch (err: unknown) { toast.error(errorMessage(err)); }
  };

  const addTestimonial = async () => {
    const { data, error } = await supabase.from("site_testimonials")
      .insert({ name: "Nuevo testimonio", result: "", text: "", sort_order: testimonials.length })
      .select().single();
    if (error) { toast.error("Error"); return; }
    setTestimonials((t) => [...t, data as Testimonial]);
  };

  const updateTestimonial = (id: string, patch: Partial<Testimonial>) => {
    setTestimonials((arr) => arr.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  const saveTestimonial = async (t: Testimonial) => {
    const { error } = await supabase.from("site_testimonials").update({
      name: t.name, result: t.result, text: t.text,
      photo_url: t.photo_url,
      photo_before_url: t.photo_before_url,
      photo_after_url: t.photo_after_url,
      sort_order: t.sort_order, visible: t.visible,
      is_12w_transformation: !!t.is_12w_transformation,
    }).eq("id", t.id);
    if (error) toast.error("Error al guardar"); else toast.success("Guardado");
  };

  const deleteTestimonial = async (id: string) => {
    if (!(await ask({ title: "¿Eliminar este testimonio?", description: "Dejará de mostrarse en la landing." }))) return;
    await supabase.from("site_testimonials").delete().eq("id", id);
    setTestimonials((t) => t.filter((x) => x.id !== id));
  };

  const onTestPhoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "testimonials");
      updateTestimonial(id, { photo_url: url });
    } catch (err: unknown) { toast.error(errorMessage(err)); }
  };

  const onTestBeforeAfter = async (
    id: string,
    field: "photo_before_url" | "photo_after_url",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "testimonials");
      updateTestimonial(id, { [field]: url } as Partial<Testimonial>);
    } catch (err: unknown) { toast.error(errorMessage(err)); }
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;

  const imageEngine = aiKeys.AI_MEDIA_PROVIDER === "openai" ? "openai" : aiKeys.AI_MEDIA_PROVIDER === "lovable" ? "lovable" : "auto";
  const imageEngineInfo = IMAGE_ENGINES.find((e) => e.id === imageEngine)!;
  const patchRecommendation = (id: string, patch: Partial<Recommendation>) =>
    setRecommendations((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const saveButton = "w-full md:w-auto";

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <p className="type-subhead text-muted-foreground">
        Lo que se ve en la home pública y la IA que lo genera.
      </p>

      {/* Claves de IA */}
      <Section
        title="Claves de IA"
        description="Toda la IA (vídeos e imágenes de ejercicios, blog, ordenar libros, precios, comidas, sugerencias del chat…) puede funcionar con la IA de Lovable o con tu clave de OpenAI."
      >
        <div className="space-y-6">
          {/* Motor de texto: orden libre + activación */}
          <ListGroup
            header="Motor de texto"
            footer="Planes, blog, comidas, chat y clasificación. Se prueba en este orden y, si uno falla o no tiene saldo, se pasa al siguiente. Apaga los que no quieras usar (deja solo uno para usar «solo esa IA»). Claude y DeepSeek solo hacen texto: las imágenes y los vídeos siempre van a OpenAI o Lovable. Si un proveedor no tiene clave puesta, se salta solo."
          >
            {textDisplay.map((id, i) => {
              const p = TEXT_PROVIDERS.find((t) => t.id === id)!;
              const on = textEnabled.has(id);
              return (
                <div key={id} className="group/row flex min-h-[56px] items-center gap-1.5 pl-4 pr-2">
                  <span className="w-4 shrink-0 text-center type-subhead tabular-nums text-muted-foreground">{on ? i + 1 : "–"}</span>
                  <div className="flex min-h-[56px] min-w-0 flex-1 items-center group-[:not(:last-child)]/row:sep-b">
                    <div className="min-w-0 flex-1 py-2">
                      <p className={cn("truncate type-body", !on && "text-muted-foreground")}>{p.label}</p>
                      <p className="truncate type-footnote text-muted-foreground">{p.desc}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground active:text-foreground [&_svg]:size-[18px]"
                      onClick={() => { void hapticTap(); moveTextProvider(id, -1); }}
                      disabled={i === 0}
                      aria-label={`Subir ${p.label}`}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground active:text-foreground [&_svg]:size-[18px]"
                      onClick={() => { void hapticTap(); moveTextProvider(id, 1); }}
                      disabled={i === textDisplay.length - 1}
                      aria-label={`Bajar ${p.label}`}
                    >
                      <ArrowDown />
                    </Button>
                    <Switch
                      aria-label={`Usar ${p.label}`}
                      checked={on}
                      onCheckedChange={(v) => { void hapticSelection(); toggleTextProvider(id, v); }}
                    />
                  </div>
                </div>
              );
            })}
          </ListGroup>

          {/* Motor de imágenes */}
          <div>
            <h3 className="type-group-header px-4 pb-1.5">Motor de imágenes</h3>
            <Tabs
              value={imageEngine}
              onValueChange={(v) => {
                void hapticSelection();
                const engine = IMAGE_ENGINES.find((e) => e.id === v);
                if (engine) saveAiSetting("AI_MEDIA_PROVIDER", engine.id, `Imágenes: ${engine.label}`);
              }}
            >
              <TabsList className="w-full">
                {IMAGE_ENGINES.map((e) => <TabsTrigger key={e.id} value={e.id}>{e.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <p className="px-4 pt-1.5 type-footnote text-muted-foreground">{imageEngineInfo.desc}</p>
          </div>

          {/* Motor de vídeos */}
          <ListGroup
            header="Motor de vídeos"
            footer="Usa el mismo motor que las imágenes. Apágalo para pausar la generación de vídeos de ejercicios."
          >
            <ListRow
              title="Vídeos de ejercicios"
              trailing={
                <Switch
                  aria-label="Generar vídeos de ejercicios"
                  checked={aiKeys.AI_VIDEO_ENABLED !== "0"}
                  onCheckedChange={(v) => { void hapticSelection(); saveAiSetting("AI_VIDEO_ENABLED", v ? "1" : "0", v ? "Vídeos activados" : "Vídeos en pausa"); }}
                />
              }
            />
          </ListGroup>

          <ListGroup header="Claves de API">
            {AI_KEYS.map((k) => (
              <div key={k.key} className="space-y-3 px-4 py-3 [&:not(:last-child)]:sep-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="type-body">{k.label}</p>
                    <p className="type-footnote text-muted-foreground">{k.desc}</p>
                  </div>
                  {aiKeys[k.key] && (
                    <Button type="button" variant="plain" className="-mr-4 shrink-0 text-destructive" aria-label={`Quitar la clave de ${k.label}`} onClick={() => { void hapticTap(); void removeAiKey(k.key); }}>
                      Quitar
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    aria-label={`Clave de ${k.label}`}
                    value={aiKeys[k.key] || ""}
                    onChange={(e) => setAiKeys((p) => ({ ...p, [k.key]: e.target.value }))}
                    placeholder={k.placeholder}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                  />
                  <Button type="button" variant="tinted" disabled={saving} onClick={() => { void hapticTap(); void saveAiKey(k.key); }}>
                    Guardar
                  </Button>
                </div>
              </div>
            ))}
          </ListGroup>
        </div>
      </Section>

      {/* Secciones de la landing */}
      <Section title="Secciones visibles en la landing" description="Activa o desactiva bloques enteros de la home pública.">
        <div className="space-y-6">
          <ListGroup>
            {([
              { key: "show_blog", label: "Blog", desc: "Enlace al blog en el menú y sección de últimos artículos." },
              { key: "show_ebooks", label: "Guías / Ebooks", desc: "Sección de guías descargables (visible en /recursos y en la landing)." },
              { key: "show_recommendations", label: "Recomendaciones", desc: "Productos recomendados (visibles en /recursos y en la landing)." },
            ] as const).map((s) => (
              <ListRow
                key={s.key}
                title={s.label}
                subtitle={s.desc}
                trailing={
                  <Switch
                    aria-label={s.label}
                    checked={sections[s.key]}
                    onCheckedChange={(v) => { void hapticSelection(); saveSectionsToggles({ ...sections, [s.key]: v }); }}
                  />
                }
              />
            ))}
          </ListGroup>

          <ListGroup>
            <ListRow
              title="Libros en la landing"
              subtitle="Cuántas guías se muestran en la portada (0 = ninguna)."
              trailing={
                <Input
                  type="number" min={0} max={24}
                  inputMode="numeric"
                  enterKeyHint="done"
                  aria-label="Libros en la landing"
                  className="w-20 text-center tabular-nums"
                  value={landingCounts.landing_ebooks_count}
                  onChange={(e) => setLandingCounts({ ...landingCounts, landing_ebooks_count: Math.max(0, Math.min(24, Number(e.target.value) || 0)) })}
                  onBlur={() => saveLandingCounts(landingCounts)}
                />
              }
            />
            <ListRow
              title="Recomendaciones en la landing"
              subtitle="Cuántos productos recomendados se muestran en la portada."
              trailing={
                <Input
                  type="number" min={0} max={24}
                  inputMode="numeric"
                  enterKeyHint="done"
                  aria-label="Recomendaciones en la landing"
                  className="w-20 text-center tabular-nums"
                  value={landingCounts.landing_recommendations_count}
                  onChange={(e) => setLandingCounts({ ...landingCounts, landing_recommendations_count: Math.max(0, Math.min(24, Number(e.target.value) || 0)) })}
                  onBlur={() => saveLandingCounts(landingCounts)}
                />
              }
            />
          </ListGroup>

          <ListGroup footer="La IA analiza libros y recomendaciones y pone primero los que más venden. En la landing se mostrarán los primeros según las cantidades de arriba.">
            <ListRow
              title={<span className="text-primary">Ordenar con IA</span>}
              trailing={ranking ? <Spinner size="sm" label="Ordenando" /> : undefined}
              onClick={() => { if (!ranking) void rankWithAi(); }}
            />
          </ListGroup>
        </div>
      </Section>

      {/* Ebooks: ahora se gestionan en el Drive */}
      <div className="flex items-start gap-4">
        <BookOpen className="h-7 w-7 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="type-headline">Libros en el Drive</p>
          <p className="mt-0.5 type-subhead text-muted-foreground">
            Los libros y el pack se gestionan en <strong className="font-semibold text-foreground">Drive · Libros</strong>. Lo que publiques allí aparece en la landing y en Recursos.
          </p>
        </div>
      </div>

      {/* Recomendaciones */}
      <Section
        title="Recomendaciones"
        description="Suplementos y productos: creatina, proteína, material… con enlace de afiliado si quieres."
        action={
          <Button
            variant="plain"
            className="-mr-4"
            onClick={() => setRecommendations((a) => [...a, { id: uid(), title: "", description: "", image_url: "", url: "", badge: "" }])}
          >
            Añadir
          </Button>
        }
      >
        {recommendations.length === 0 ? (
          <EmptyState icon={Sparkles} title="Sin recomendaciones" description="Añade suplementos o material con su enlace." />
        ) : (
          <ListGroup>
            {recommendations.map((r) => (
              <div key={r.id} className={BLOCK}>
                <div className="flex items-center gap-3">
                  <ImageWithFallback src={r.image_url} className="h-16 w-16 shrink-0 rounded-[10px] object-cover" iconClassName="h-6 w-6" />
                  <label className="pressable inline-flex min-h-[44px] cursor-pointer items-center type-body text-primary">
                    <input type="file" accept="image/*" className="hidden" onChange={(ev) => onRecImage(r.id, ev)} />
                    {r.image_url ? "Cambiar imagen" : "Subir imagen"}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={() => { void hapticTap(); setRecommendations((a) => a.filter((x) => x.id !== r.id)); }}
                    aria-label={`Eliminar ${r.title || "recomendación"}`}
                  >
                    <Trash2 className="h-[18px] w-[18px] text-destructive" />
                  </Button>
                </div>
                <Input aria-label="Título" autoCapitalize="sentences" enterKeyHint="next" placeholder="Título (Creatina Monohidratada)" value={r.title} onChange={(ev) => patchRecommendation(r.id, { title: ev.target.value })} />
                <Textarea aria-label="Descripción" rows={2} placeholder="Por qué la recomiendas" value={r.description} onChange={(ev) => patchRecommendation(r.id, { description: ev.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input aria-label="Etiqueta" autoCapitalize="sentences" enterKeyHint="next" placeholder="Etiqueta (Top, Recomendado…)" value={r.badge} onChange={(ev) => patchRecommendation(r.id, { badge: ev.target.value })} />
                  <Input aria-label="URL" {...URL_INPUT} enterKeyHint="done" className={MONO_FIELD} placeholder="URL (afiliado o web)" value={r.url} onChange={(ev) => patchRecommendation(r.id, { url: ev.target.value })} />
                </div>
              </div>
            ))}
          </ListGroup>
        )}
        <Button variant="tinted" className={saveButton} onClick={saveRecommendations} disabled={saving}>{saving ? "Guardando…" : "Guardar recomendaciones"}</Button>
      </Section>

      {/* Vídeo del Hero */}
      <Section
        title="Vídeo del Hero (landing)"
        description="Sube un vídeo corto (15–45 s, MP4/WebM, máx 100 MB) que se reproducirá en silencio en la portada. Mejora notablemente la conversión."
      >
        {hero.hero_video_url ? (
          <div className="overflow-hidden rounded-2xl bg-black">
            <video
              key={hero.hero_video_url}
              src={hero.hero_video_url}
              poster={hero.hero_video_poster_url || undefined}
              controls
              playsInline
              className="max-h-72 w-full bg-black object-contain"
            />
          </div>
        ) : (
          <EmptyState icon={Film} title="Sin vídeo" description="Sin vídeo, el hero muestra un fondo limpio sin reproductor." className="py-6" />
        )}

        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer ${videoUploading ? "pointer-events-none opacity-60" : ""}`}>
            <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={onHeroVideo} />
            <span className={`${UPLOAD_CHIP} bg-primary/15 text-primary active:opacity-60`}>
              {videoUploading ? <Spinner size="sm" /> : null}
              {videoUploading ? "Subiendo…" : hero.hero_video_url ? "Reemplazar vídeo" : "Subir vídeo"}
            </span>
          </label>
          <label className={`cursor-pointer ${posterUploading ? "pointer-events-none opacity-60" : ""}`}>
            <input type="file" accept="image/*" className="hidden" onChange={onHeroPoster} />
            <span className={`${UPLOAD_CHIP} bg-secondary active:bg-accent`}>
              {posterUploading ? <Spinner size="sm" /> : null}
              {posterUploading ? "Subiendo…" : "Subir miniatura (poster)"}
            </span>
          </label>
          {hero.hero_video_url && (
            <button
              type="button"
              onClick={() => { void hapticTap(); void removeHeroVideo(); }}
              className={`${UPLOAD_CHIP} bg-secondary text-destructive active:bg-accent`}
            >
              Quitar vídeo
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="hero-video-url" className={FIELD_LABEL}>O pega una URL de vídeo (MP4 directo)</Label>
            <Input
              id="hero-video-url"
              {...URL_INPUT}
              enterKeyHint="next"
              className={MONO_FIELD}
              placeholder="https://…"
              value={hero.hero_video_url}
              onChange={(e) => setHero((h) => ({ ...h, hero_video_url: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="hero-poster-url" className={FIELD_LABEL}>URL de miniatura (opcional)</Label>
            <Input
              id="hero-poster-url"
              {...URL_INPUT}
              enterKeyHint="done"
              className={MONO_FIELD}
              placeholder="https://…"
              value={hero.hero_video_poster_url}
              onChange={(e) => setHero((h) => ({ ...h, hero_video_poster_url: e.target.value }))}
            />
          </div>
          <Button variant="tinted" className={saveButton} onClick={saveHero} disabled={saving}>
            {saving ? "Guardando…" : "Guardar URLs"}
          </Button>
        </div>
      </Section>

      {/* Enlaces a las tiendas de la app */}
      <Section
        title="Enlaces a la app (App Store / Google Play)"
        description="Pega aquí las URLs cuando publiques la app. Si dejas un campo vacío, ese botón se ocultará en la web (ideal antes de estar publicado)."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="show-app-download" className={FIELD_LABEL}>Mostrar «App móvil» en la web</Label>
              <p className="type-footnote text-muted-foreground">Enlace a la página de instalación (APK Android e iPhone desde Safari). Apágalo cuando estés en las tiendas.</p>
            </div>
            <Switch id="show-app-download" checked={showAppDownload} onCheckedChange={(v) => void toggleAppDownload(v)} />
          </div>
          <div>
            <Label htmlFor="app-store-url" className={FIELD_LABEL}>URL App Store (iOS)</Label>
            <Input
              id="app-store-url"
              {...URL_INPUT}
              enterKeyHint="next"
              className={MONO_FIELD}
              placeholder="https://apps.apple.com/app/id0000000000"
              value={stores.app_store_url}
              onChange={(e) => setStores((s) => ({ ...s, app_store_url: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="play-store-url" className={FIELD_LABEL}>URL Google Play (Android)</Label>
            <Input
              id="play-store-url"
              {...URL_INPUT}
              enterKeyHint="done"
              className={MONO_FIELD}
              placeholder="https://play.google.com/store/apps/details?id=…"
              value={stores.play_store_url}
              onChange={(e) => setStores((s) => ({ ...s, play_store_url: e.target.value }))}
            />
          </div>
          <Button variant="tinted" className={saveButton} onClick={saveStores} disabled={saving}>
            {saving ? "Guardando…" : "Guardar enlaces"}
          </Button>
        </div>
      </Section>

      {/* Plazas de Transformación */}
      <Section
        title="Plazas de Transformación"
        description="Esta cifra aparece en la landing. Usa 0 cuando no queden plazas disponibles."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:max-w-[180px]">
            <Label htmlFor="transformation-slots" className={FIELD_LABEL}>Plazas disponibles este mes</Label>
            <Input
              id="transformation-slots"
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              enterKeyHint="done"
              className="tabular-nums"
              value={transformationSlots}
              onChange={(e) => setTransformationSlots(Number(e.target.value))}
            />
          </div>
          <Button variant="tinted" className={saveButton} onClick={saveTransformationSlots} disabled={saving || !Number.isFinite(transformationSlots)}>
            {saving ? "Guardando…" : "Guardar plazas"}
          </Button>
        </div>
      </Section>

      {/* Entrenador */}
      <Section title="Sobre el fundador">
        <div className="flex items-center gap-4">
          <ImageWithFallback
            src={trainer.trainer_photo_url}
            fallbackIcon={User}
            iconClassName="h-8 w-8"
            className="h-20 w-20 shrink-0 rounded-full object-cover"
          />
          <label className="pressable inline-flex min-h-[44px] cursor-pointer items-center type-body text-primary">
            <input type="file" accept="image/*" className="hidden" onChange={onTrainerPhoto} />
            {trainer.trainer_photo_url ? "Cambiar foto" : "Subir foto"}
          </label>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="trainer-name" className={FIELD_LABEL}>Nombre</Label>
            <Input id="trainer-name" autoCapitalize="words" autoComplete="name" enterKeyHint="next" value={trainer.trainer_name} onChange={(e) => setTrainer((t) => ({ ...t, trainer_name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="trainer-bio" className={FIELD_LABEL}>Bio</Label>
            <Textarea id="trainer-bio" rows={4} value={trainer.trainer_bio} onChange={(e) => setTrainer((t) => ({ ...t, trainer_bio: e.target.value }))} placeholder="Llevo años ayudando a personas a…" />
          </div>
          <div>
            <Label htmlFor="trainer-phone" className={FIELD_LABEL}>Teléfono / WhatsApp de contacto</Label>
            <Input id="trainer-phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="done" value={trainer.contact_phone} onChange={(e) => setTrainer((t) => ({ ...t, contact_phone: e.target.value }))} placeholder="+34 600 000 000" />
            <p className="mt-1.5 px-1 type-footnote text-muted-foreground">Se usa en el botón «Hablar por WhatsApp» de la solicitud de entrenadores.</p>
          </div>
          <Button variant="tinted" className={saveButton} onClick={saveTrainer} disabled={saving}>{saving ? "Guardando…" : "Guardar entrenador"}</Button>
        </div>
      </Section>

      {/* Testimonios */}
      <Section
        title="Testimonios"
        action={<Button variant="plain" className="-mr-4" onClick={addTestimonial}>Añadir</Button>}
      >
        {testimonials.length === 0 ? (
          <EmptyState icon={Star} title="Sin testimonios" description="Añade el primero para mostrarlo en la landing." />
        ) : (
          <ListGroup>
            {testimonials.map((t) => (
              <div key={t.id} className={BLOCK}>
                <div className="flex items-center gap-3">
                  <ImageWithFallback
                    src={t.photo_url}
                    fallbackIcon={User}
                    iconClassName="h-6 w-6"
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                  <label className="pressable inline-flex min-h-[44px] cursor-pointer items-center type-body text-primary">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onTestPhoto(t.id, e)} />
                    {t.photo_url ? "Cambiar foto" : "Subir foto"}
                  </label>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="type-footnote text-muted-foreground">Visible</span>
                    <Switch aria-label={`Visible: ${t.name || "testimonio"}`} checked={t.visible} onCheckedChange={(v) => { void hapticSelection(); updateTestimonial(t.id, { visible: v }); }} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input aria-label="Nombre" autoCapitalize="words" enterKeyHint="next" placeholder="Nombre" value={t.name} onChange={(e) => updateTestimonial(t.id, { name: e.target.value })} />
                  <Input aria-label="Resultado" enterKeyHint="next" placeholder="Resultado (-8kg en 3 meses)" value={t.result} onChange={(e) => updateTestimonial(t.id, { result: e.target.value })} />
                </div>
                <Textarea aria-label="Texto del testimonio" rows={3} placeholder="Texto del testimonio" value={t.text} onChange={(e) => updateTestimonial(t.id, { text: e.target.value })} />
                <div className="grid grid-cols-2 gap-3 pt-3 sep-t">
                  {([
                    { field: "photo_before_url", label: "Antes", alt: "Antes" },
                    { field: "photo_after_url", label: "Después", alt: "Después" },
                  ] as const).map(({ field, label, alt }) => {
                    const url = t[field];
                    return (
                      <div key={field} className="space-y-2">
                        <p className="type-subhead font-medium text-muted-foreground">{label}</p>
                        <ImageWithFallback
                          src={url}
                          alt={alt}
                          className="aspect-[3/4] w-full rounded-[10px] object-cover"
                          fallback={
                            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-[10px] bg-secondary type-footnote text-muted-foreground">
                              <ImageIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                              Sin foto
                            </div>
                          }
                        />
                        <label className={`${UPLOAD_CHIP} w-full bg-secondary active:bg-accent`}>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => onTestBeforeAfter(t.id, field, e)} />
                          {url ? "Cambiar" : "Subir"}
                        </label>
                        {url && (
                          <button type="button" onClick={() => { void hapticTap(); updateTestimonial(t.id, { [field]: "" } as Partial<Testimonial>); }} className="pressable min-h-[44px] w-full type-subhead text-destructive">
                            Quitar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="type-footnote text-muted-foreground">Si subes Antes y Después, en la landing se mostrarán como par comparativo.</p>
                <div className="flex items-center justify-between gap-4 pt-3 sep-t">
                  <div className="min-w-0">
                    <Label>Transformación 12 semanas</Label>
                    <p className="type-footnote text-muted-foreground">Si lo activas, este testimonio se destacará en la sección premium.</p>
                  </div>
                  <Switch
                    aria-label={`Transformación 12 semanas: ${t.name || "testimonio"}`}
                    checked={!!t.is_12w_transformation}
                    onCheckedChange={(v) => { void hapticSelection(); updateTestimonial(t.id, { is_12w_transformation: v }); }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="tinted" onClick={() => { void hapticTap(); void saveTestimonial(t); }}>Guardar</Button>
                  <Button variant="ghost" size="icon" aria-label={`Eliminar testimonio${t.name ? `: ${t.name}` : ""}`} onClick={() => { void hapticTap(); void deleteTestimonial(t.id); }}>
                    <Trash2 className="h-[18px] w-[18px] text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </ListGroup>
        )}
      </Section>
      {confirmDialog}
    </div>
  );
};

export default SiteContentEditor;
