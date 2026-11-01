import PublicLayout from "@/web/components/PublicLayout";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/shared/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Clock, ArrowRight, ArrowLeft, BookOpen, GraduationCap, BarChart3, Atom, Dumbbell, PersonStanding, CalendarRange, Apple, Moon, HelpCircle, HeartPulse, Brain, Timer, ChevronRight } from "lucide-react";
import { CATEGORIES, LEVEL_LABEL, EVIDENCE_LABEL, categoryBySlug, type Level, type Evidence } from "@/shared/lib/academy";
import { IconTile } from "@/shared/components/ui/icon-tile";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  reading_minutes: number | null;
  category: string | null;
  level: string | null;
  evidence_level: string | null;
  order_index: number | null;
  cover_url: string | null;
}

const LEVELS: (Level | "all")[] = ["all", "beginner", "intermediate", "advanced"];

const ICONS: Record<string, typeof BookOpen> = {
  fundamentos: GraduationCap, "sobrecarga-progresiva": BarChart3, hipertrofia: Dumbbell, biomecanica: Atom,
  "sistema-nervioso-fuerza": Brain, programacion: CalendarRange, tecnica: Timer, calistenia: PersonStanding,
  nutricion: Apple, recuperacion: Moon, mitos: HelpCircle, "entrenamiento-avanzado": HeartPulse,
};

/** Portada del artículo con respaldo: si la imagen falla, queda el número de la lista. */
function PostCover({ src, index }: { src: string | null; index: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-secondary type-headline font-semibold text-muted-foreground">
        {String(index).padStart(2, "0")}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded-[14px] bg-secondary object-cover"
    />
  );
}

const Blog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const cat = params.get("c") || "all";
  const [level, setLevel] = useState<Level | "all">("all");
  const openCat = (slug: string) => {
    setLevel("all");
    setParams(slug === "all" ? {} : { c: slug });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, published_at, reading_minutes, category, level, evidence_level, order_index, cover_url")
        .eq("published", true)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("published_at", { ascending: false });
      setPosts((data || []) as Post[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => posts.filter((p) => (cat === "all" || p.category === cat) && (level === "all" || p.level === level)),
    [posts, cat, level],
  );
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    posts.forEach((p) => { if (p.category) m[p.category] = (m[p.category] || 0) + 1; });
    return m;
  }, [posts]);
  const uncategorized = useMemo(() => posts.filter((p) => !p.category), [posts]);

  /** Metadatos del artículo en una sola línea: nivel y evidencia. Los minutos quedan
   *  para la ficha, porque al añadirlos la línea partía y dejaba un «·» suelto. */
  const metaItems = (p: Post) =>
    [
      p.level ? LEVEL_LABEL[p.level as Level] : null,
      p.evidence_level ? EVIDENCE_LABEL[p.evidence_level as Evidence]?.label : null,
    ].filter(Boolean) as string[];

  const chip = (active: boolean) =>
    `shrink-0 h-9 px-4 rounded-full type-subhead transition-colors ${active ? "bg-foreground text-background font-medium" : "bg-secondary text-muted-foreground hover:text-foreground"}`;

  return (
    <PublicLayout title="Academia de entrenamiento basada en evidencia" description="Academia gratuita: hipertrofia, fuerza, biomecánica, calistenia, nutrición y recuperación explicadas con evidencia científica y por niveles.">
      <Helmet>
        <title>Academia de entrenamiento basada en evidencia · Autopilot</title>
        <meta name="description" content="Academia gratuita: hipertrofia, fuerza, biomecánica, calistenia, nutrición y recuperación explicadas con evidencia científica y por niveles." />
        <link rel="canonical" href="https://autopilotplan.com/blog" />
        <meta property="og:title" content="Academia de entrenamiento basada en evidencia · Autopilot" />
        <meta property="og:description" content="Aprende a entrenar con criterio: artículos gratuitos por niveles, con referencias científicas." />
        <meta property="og:url" content="https://autopilotplan.com/blog" />
        <meta property="og:type" content="website" />
      </Helmet>


      <div className="container mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <header className="mx-auto mb-16 max-w-3xl text-center animate-in fade-in duration-1000 motion-reduce:animate-none sm:mb-24">
          <p className="mb-2 type-subhead text-primary">Academia · Gratis</p>
          <h1 className="type-display mb-5">
            Aprende a entrenar con criterio.
          </h1>
          <p className="mx-auto max-w-2xl type-body text-muted-foreground md:text-[21px] md:leading-[28px]">
            Hipertrofia, fuerza, biomecánica, calistenia, nutrición y recuperación. Explicado con claridad, por niveles y
            diferenciando lo que está demostrado de lo que todavía no.
          </p>
        </header>

        {cat === "all" ? (
          <>
          {/* Móvil: una lista compacta de rutas (12 tarjetas de 200 px eran 2.400 px de
              scroll). Escritorio: la rejilla de tarjetas. */}
          <section aria-label="Rutas de aprendizaje" className="overflow-hidden rounded-card bg-card sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:bg-transparent lg:grid-cols-3">
            {CATEGORIES.map((c) => {
              const Icon = ICONS[c.slug] || BookOpen;
              const n = counts[c.slug] || 0;
              const lessons = n ? `${n} ${n === 1 ? "lección" : "lecciones"}` : "Próximamente";
              return (
                <Fragment key={c.slug}>
                  <button
                    onClick={() => openCat(c.slug)}
                    className="group flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-secondary active:bg-accent sm:hidden"
                  >
                    <IconTile icon={Icon} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate type-headline">{c.name}</span>
                      <span className="block type-footnote text-muted-foreground">{lessons}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>

                  <button
                    onClick={() => openCat(c.slug)}
                    className="group relative hidden min-h-[200px] flex-col justify-between overflow-hidden rounded-card bg-card p-6 text-left transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-secondary sm:flex"
                  >
                    <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl transition-colors group-hover:bg-primary/20" />
                    <div className="relative">
                      <IconTile icon={Icon} size="md" />
                    </div>
                    <div className="relative mt-6">
                      <h2 className="font-rounded type-title2">{c.name}</h2>
                      <p className="mt-1.5 line-clamp-2 type-subhead leading-relaxed text-muted-foreground">{c.summary}</p>
                      <p className="mt-4 inline-flex items-center gap-1 type-footnote font-medium text-primary">
                        {lessons}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </p>
                    </div>
                  </button>
                </Fragment>
              );
            })}
          </section>
          {uncategorized.length > 0 && (
            <section aria-label="Otros artículos" className="mt-14">
              <h2 className="type-title1 mb-4">Otros artículos</h2>
              <ol className="space-y-3">
                {uncategorized.map((p, i) => (
                  <li key={p.id}>
                    <Link to={`/blog/${p.slug}`} className="group flex items-center gap-4 rounded-media bg-card p-4 transition-colors hover:bg-secondary sm:p-5">
                      <PostCover src={p.cover_url} index={i + 1} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold tracking-tight group-hover:text-primary transition-colors">{p.title}</h3>
                        <p className="mt-1 truncate type-footnote text-muted-foreground">
                          {metaItems(p).join(" · ")}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
          </>
        ) : (
          <>
            <button onClick={() => openCat("all")} className="inline-flex items-center gap-1.5 type-subhead text-muted-foreground hover:text-foreground mb-6 h-11">
              <ArrowLeft className="w-4 h-4" /> Todas las rutas
            </button>
            <div className="mb-6">
              <h2 className="type-title1">{categoryBySlug(cat)?.name}</h2>
              <p className="text-muted-foreground mt-2">{categoryBySlug(cat)?.summary}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-6" role="group" aria-label="Nivel">
              {LEVELS.map((l) => (
                <button key={l} className={chip(level === l)} onClick={() => setLevel(l)}>
                  {l === "all" ? "Todos los niveles" : LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
            {loading ? (
              <p className="text-muted-foreground py-20 text-center">Cargando…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-card border border-dashed border-border py-20 text-center">
                <p className="text-muted-foreground">Estamos revisando las lecciones de esta ruta. Pronto estarán disponibles.</p>
              </div>
            ) : (
              <ol className="space-y-3">
                {filtered.map((p, i) => (
                  <li key={p.id}>
                    <Link to={`/blog/${p.slug}`} className="group flex items-center gap-4 rounded-media bg-card p-4 transition-colors hover:bg-secondary sm:p-5">
                      <PostCover src={p.cover_url} index={i + 1} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold tracking-tight group-hover:text-primary transition-colors">{p.title}</h3>
                        <p className="mt-1 truncate type-footnote text-muted-foreground">
                          {metaItems(p).join(" · ")}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        <p className="type-footnote text-muted-foreground mt-12 max-w-2xl leading-relaxed">
          Contenido educativo. No sustituye el consejo de un profesional sanitario. Cada artículo se revisa antes de publicarse
          e indica el nivel de evidencia de sus conclusiones.
        </p>
      </div>
    </PublicLayout>
  );
};

export default Blog;
