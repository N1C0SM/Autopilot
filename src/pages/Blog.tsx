import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Clock, ArrowRight, ArrowLeft, BookOpen, GraduationCap, BarChart3, Atom, Dumbbell, PersonStanding, CalendarRange, Apple, Moon, HelpCircle, HeartPulse } from "lucide-react";
import { CATEGORIES, LEVEL_LABEL, EVIDENCE_LABEL, categoryBySlug, type Level, type Evidence } from "@/lib/academy";

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
}

const LEVELS: (Level | "all")[] = ["all", "beginner", "intermediate", "advanced"];

const ICONS: Record<string, typeof BookOpen> = {
  fundamentos: GraduationCap, "volumen-frecuencia": BarChart3, biomecanica: Atom, fuerza: Dumbbell,
  calistenia: PersonStanding, programacion: CalendarRange, nutricion: Apple, recuperacion: Moon,
  mitos: HelpCircle, "salud-longevidad": HeartPulse,
};

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
        .select("id, slug, title, excerpt, published_at, reading_minutes, category, level, evidence_level, order_index")
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

  const chip = (active: boolean) =>
    `shrink-0 h-9 px-4 rounded-full text-sm transition-colors ${active ? "bg-foreground text-background font-medium" : "bg-secondary text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Academia de entrenamiento basada en evidencia · Autopilot</title>
        <meta name="description" content="Academia gratuita: hipertrofia, fuerza, biomecánica, calistenia, nutrición y recuperación explicadas con evidencia científica y por niveles." />
        <link rel="canonical" href="https://autopilotplan.com/blog" />
        <meta property="og:title" content="Academia de entrenamiento basada en evidencia · Autopilot" />
        <meta property="og:description" content="Aprende a entrenar con criterio: artículos gratuitos por niveles, con referencias científicas." />
        <meta property="og:url" content="https://autopilotplan.com/blog" />
        <meta property="og:type" content="website" />
      </Helmet>

      <nav className="app-chrome border-b sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="font-display text-xl font-bold text-gradient">Autopilot</Link>
          <Link to="/onboarding" className="text-sm text-primary font-medium hover:underline">Crear mi rutina gratis →</Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <header className="mb-14 max-w-2xl">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Academia · Gratis</p>
          <h1 className="text-4xl sm:text-6xl font-bold font-display tracking-tight leading-[1.05] mb-5">
            Aprende a entrenar con criterio.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Hipertrofia, fuerza, biomecánica, calistenia, nutrición y recuperación. Explicado con claridad, por niveles y
            diferenciando lo que está demostrado de lo que todavía no.
          </p>
        </header>

        {cat === "all" ? (
          <section aria-label="Rutas de aprendizaje" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((c, i) => {
              const Icon = ICONS[c.slug] || BookOpen;
              const n = counts[c.slug] || 0;
              return (
                <button
                  key={c.slug}
                  onClick={() => openCat(c.slug)}
                  className="group relative text-left overflow-hidden rounded-3xl border border-border bg-card p-6 min-h-[200px] flex flex-col justify-between transition-all hover:border-primary/60 hover:-translate-y-0.5"
                >
                  <div aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-colors" />
                  <div className="relative flex items-start justify-between">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Icon className="w-6 h-6" />
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="relative mt-6">
                    <h2 className="text-xl font-semibold font-display tracking-tight">{c.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{c.summary}</p>
                    <p className="text-xs text-primary font-medium mt-4 inline-flex items-center gap-1">
                      {n ? `${n} ${n === 1 ? "lección" : "lecciones"}` : "Próximamente"}
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </p>
                  </div>
                </button>
              );
            })}
          </section>
        ) : (
          <>
            <button onClick={() => openCat("all")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 h-11">
              <ArrowLeft className="w-4 h-4" /> Todas las rutas
            </button>
            <div className="mb-6">
              <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">{categoryBySlug(cat)?.name}</h2>
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
              <div className="py-20 text-center border border-dashed border-border rounded-3xl">
                <p className="text-muted-foreground">Estamos revisando las lecciones de esta ruta. Pronto estarán disponibles.</p>
              </div>
            ) : (
              <ol className="space-y-3">
                {filtered.map((p, i) => (
                  <li key={p.id}>
                    <Link to={`/blog/${p.slug}`} className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-primary/60 transition-colors">
                      <span className="shrink-0 h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold tracking-tight group-hover:text-primary transition-colors">{p.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                          {p.level && <span>{LEVEL_LABEL[p.level as Level]}</span>}
                          {p.evidence_level && <span>· {EVIDENCE_LABEL[p.evidence_level as Evidence]?.label}</span>}
                          {p.reading_minutes ? <span className="inline-flex items-center gap-1">· <Clock className="w-3 h-3" /> {p.reading_minutes} min</span> : null}
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground mt-12 max-w-2xl leading-relaxed">
          Contenido educativo. No sustituye el consejo de un profesional sanitario. Cada artículo se revisa antes de publicarse
          e indica el nivel de evidencia de sus conclusiones.
        </p>
      </main>
    </div>
  );
};

export default Blog;
