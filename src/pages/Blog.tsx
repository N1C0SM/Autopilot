import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Clock, ArrowRight } from "lucide-react";
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

const Blog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("all");
  const [level, setLevel] = useState<Level | "all">("all");

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

        <section aria-label="Categorías" className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            <button className={chip(cat === "all")} onClick={() => setCat("all")}>Todo</button>
            {CATEGORIES.map((c) => (
              <button key={c.slug} className={chip(cat === c.slug)} onClick={() => setCat(c.slug)}>
                {c.name}{counts[c.slug] ? ` · ${counts[c.slug]}` : ""}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mt-2" role="group" aria-label="Nivel">
            {LEVELS.map((l) => (
              <button key={l} className={chip(level === l)} onClick={() => setLevel(l)}>
                {l === "all" ? "Todos los niveles" : LEVEL_LABEL[l]}
              </button>
            ))}
          </div>
          {cat !== "all" && (
            <p className="text-sm text-muted-foreground mt-4">{categoryBySlug(cat)?.summary}</p>
          )}
        </section>

        {loading ? (
          <p className="text-muted-foreground py-20 text-center">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-3xl">
            <p className="text-muted-foreground">Estamos revisando los artículos de esta sección. Pronto estarán disponibles.</p>
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {filtered.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="group flex flex-col sm:flex-row sm:items-center gap-3 py-6">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                    {p.category && <span className="text-primary font-medium">{categoryBySlug(p.category)?.name}</span>}
                    {p.level && <span>· {LEVEL_LABEL[p.level as Level]}</span>}
                    {p.evidence_level && <span>· {EVIDENCE_LABEL[p.evidence_level as Evidence]?.label}</span>}
                    {p.reading_minutes ? <span className="inline-flex items-center gap-1">· <Clock className="w-3 h-3" /> {p.reading_minutes} min</span> : null}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight group-hover:text-primary transition-colors">{p.title}</h2>
                  {p.excerpt && <p className="text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{p.excerpt}</p>}
                </div>
                <ArrowRight className="hidden sm:block w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
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
