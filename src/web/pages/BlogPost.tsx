import PublicLayout from "@/web/components/PublicLayout";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/shared/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Calendar, Clock, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { EVIDENCE_LABEL, LEVEL_LABEL, categoryBySlug, extractToc, slugifyHeading, type Evidence, type Level, type Reference } from "@/shared/lib/academy";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_markdown: string;
  cover_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string | null;
  reading_minutes: number | null;
  author_name: string | null;
  category: string | null;
  level: string | null;
  evidence_level: string | null;
  order_index: number | null;
  references: unknown;
}
type Lite = Pick<Post, "slug" | "title" | "level" | "order_index" | "category">;

const textOf = (children: React.ReactNode): string =>
  Array.isArray(children) ? children.map(textOf).join("") : typeof children === "string" ? children : (children as { props?: { children?: React.ReactNode } })?.props?.children ? textOf((children as { props: { children: React.ReactNode } }).props.children) : "";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [siblings, setSiblings] = useState<Lite[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("blog_posts").select("*").eq("slug", slug).eq("published", true).maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setPost(data as Post);
      if (data.category) {
        const { data: sib } = await supabase
          .from("blog_posts")
          .select("slug, title, level, order_index, category")
          .eq("published", true)
          .eq("category", data.category)
          .order("order_index", { ascending: true });
        setSiblings((sib || []) as Lite[]);
      }
      setLoading(false);
    })();
  }, [slug]);

  const toc = useMemo(() => extractToc(post?.body_markdown || ""), [post]);
  const refs = (Array.isArray(post?.references) ? post!.references : []) as Reference[];
  const idx = siblings.findIndex((s) => s.slug === post?.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const related = siblings.filter((s) => s.slug !== post?.slug).slice(0, 3);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Helmet><title>Artículo no encontrado — Autopilot</title><meta name="robots" content="noindex" /></Helmet>
        <p className="text-muted-foreground mb-4">Este artículo no existe.</p>
        <button onClick={() => navigate("/blog")} className="text-primary hover:underline type-subhead">← Volver a la Academia</button>
      </div>
    );
  }

  const url = `https://autopilotplan.com/blog/${post.slug}`;
  const title = post.seo_title || post.title;
  const desc = post.seo_description || post.excerpt || "";
  const cat = categoryBySlug(post.category);
  const ev = post.evidence_level ? EVIDENCE_LABEL[post.evidence_level as Evidence] : null;

  const H = (Tag: "h2" | "h3") => ({ children }: { children?: React.ReactNode }) => (
    <Tag id={slugifyHeading(textOf(children).replace(/[*_`]/g, ""))} className="scroll-mt-24">{children}</Tag>
  );

  return (
    <PublicLayout title={post.title} description={post.excerpt || post.title}>
      <Helmet>
        <title>{`${title} · Autopilot`}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        {post.cover_url && <meta property="og:image" content={post.cover_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": ["Article", "LearningResource"],
          headline: post.title,
          description: desc,
          inLanguage: "es-ES",
          isAccessibleForFree: true,
          educationalLevel: post.level ? LEVEL_LABEL[post.level as Level] : undefined,
          about: cat?.name,
          datePublished: post.published_at,
          dateModified: post.updated_at || post.published_at,
          author: { "@type": "Person", name: post.author_name || "Autopilot" },
          publisher: { "@type": "Organization", name: "Autopilot", url: "https://autopilotplan.com" },
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          citation: refs.map((r) => ({ "@type": "ScholarlyArticle", name: r.title, author: r.authors, datePublished: String(r.year), sameAs: r.doi ? `https://doi.org/${r.doi}` : r.url })),
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Academia", item: "https://autopilotplan.com/blog" },
            ...(cat ? [{ "@type": "ListItem", position: 2, name: cat.name, item: "https://autopilotplan.com/blog" }] : []),
            { "@type": "ListItem", position: cat ? 3 : 2, name: post.title, item: url },
          ],
        })}</script>
      </Helmet>


      <div className="container mx-auto max-w-6xl px-4 py-12 sm:py-16 lg:grid lg:grid-cols-[1fr_220px] lg:gap-16">
        <article className="max-w-3xl min-w-0">
          <nav aria-label="Migas de pan" className="type-footnote text-muted-foreground mb-8 flex items-center gap-1.5 flex-wrap">
            <Link to="/blog" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="w-3 h-3" /> Academia</Link>
            {cat && <><span>/</span><span>{cat.name}</span></>}
          </nav>

          <header className="mb-10">
            <div className="flex flex-wrap gap-2 mb-5">
              {post.level && <span className="type-footnote px-3 py-1 rounded-full bg-secondary text-foreground">{LEVEL_LABEL[post.level as Level]}</span>}
              {ev && <span title={ev.hint} className="type-footnote px-3 py-1 rounded-full bg-primary/15 text-primary">{ev.label}</span>}
            </div>
            <h1 className="type-display-sm mb-5">{post.title}</h1>
            {post.excerpt && <p className="type-body text-muted-foreground md:text-[19px] md:leading-[28px] mb-5">{post.excerpt}</p>}
            <div className="flex flex-wrap items-center gap-4 type-footnote text-muted-foreground">
              {post.author_name && <span>Por {post.author_name}</span>}
              {post.published_at && (
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />
                  {new Date(post.updated_at || post.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
              {post.reading_minutes ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {post.reading_minutes} min de lectura</span> : null}
            </div>
          </header>

          {toc.length > 1 && (
            <details className="lg:hidden mb-10 rounded-2xl bg-secondary/50 p-4">
              <summary className="type-subhead font-medium cursor-pointer">Contenido</summary>
              <ol className="mt-3 space-y-2 type-subhead">
                {toc.map((t) => <li key={t.id} className={t.depth === 3 ? "pl-4" : ""}><a href={`#${t.id}`} className="text-muted-foreground hover:text-foreground">{t.text}</a></li>)}
              </ol>
            </details>
          )}

          {post.cover_url && (
            <div className="mb-10 rounded-3xl overflow-hidden">
              <img loading="lazy" decoding="async" src={post.cover_url} alt={post.title} className="w-full h-auto object-cover" />
            </div>
          )}

          <div className="prose prose-invert prose-lg max-w-none prose-headings:font-display prose-headings:tracking-tight prose-p:leading-relaxed prose-a:text-primary prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ h2: H("h2"), h3: H("h3") }}>{post.body_markdown}</ReactMarkdown>
          </div>

          {refs.length > 0 && (
            <section id="referencias" className="mt-16 pt-8 border-t border-border">
              <h2 className="type-title2 mb-5">Referencias</h2>
              <ol className="space-y-4 type-subhead text-muted-foreground list-decimal pl-5">
                {refs.map((r, i) => (
                  <li key={i} className="leading-relaxed">
                    {r.authors} ({r.year}). <span className="text-foreground">{r.title}</span>.{r.journal ? <em> {r.journal}.</em> : null}{" "}
                    {r.doi ? <a className="text-primary hover:underline break-all" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">doi:{r.doi}</a>
                      : r.url ? <a className="text-primary hover:underline break-all" href={r.url} target="_blank" rel="noreferrer">Enlace</a> : null}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(prev || next) && (
            <nav aria-label="Navegación entre artículos" className="mt-16 grid sm:grid-cols-2 gap-3">
              {prev ? (
                <Link to={`/blog/${prev.slug}`} className="rounded-2xl bg-secondary/50 p-5 hover:bg-secondary transition-colors">
                  <span className="type-footnote text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Anterior</span>
                  <p className="font-medium mt-1">{prev.title}</p>
                </Link>
              ) : <span />}
              {next && (
                <Link to={`/blog/${next.slug}`} className="rounded-2xl bg-secondary/50 p-5 hover:bg-secondary transition-colors sm:text-right">
                  <span className="type-footnote text-muted-foreground inline-flex items-center gap-1">Siguiente <ArrowRight className="w-3 h-3" /></span>
                  <p className="font-medium mt-1">{next.title}</p>
                </Link>
              )}
            </nav>
          )}

          {related.length > 0 && (
            <section className="mt-16">
              <h2 className="type-title2 mb-4">Más sobre {cat?.name.toLowerCase()}</h2>
              <ul className="divide-y divide-border border-y border-border">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link to={`/blog/${r.slug}`} className="flex items-center justify-between gap-3 py-4 hover:text-primary transition-colors">
                      <span>{r.title}</span>
                      {r.level && <span className="type-footnote text-muted-foreground shrink-0">{LEVEL_LABEL[r.level as Level]}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-16 p-6 sm:p-8 bg-card border border-border rounded-3xl text-center">
            <h3 className="type-title1 mb-3">Pon esto en práctica</h3>
            <p className="type-subhead text-muted-foreground mb-5 max-w-md mx-auto">Crea tu rutina gratis y registra tus entrenamientos. Sin tarjeta.</p>
            <Link to="/onboarding" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold type-subhead hover:opacity-90 transition-opacity">
              Crear mi rutina gratis →
            </Link>
          </div>
        </article>

        {toc.length > 1 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="type-footnote uppercase tracking-widest text-muted-foreground mb-3">Contenido</p>
              <ol className="space-y-2 type-subhead border-l border-border">
                {toc.map((t) => (
                  <li key={t.id} className={t.depth === 3 ? "pl-7" : "pl-4"}>
                    <a href={`#${t.id}`} className="text-muted-foreground hover:text-foreground transition-colors">{t.text}</a>
                  </li>
                ))}
                {refs.length > 0 && <li className="pl-4"><a href="#referencias" className="text-muted-foreground hover:text-foreground">Referencias</a></li>}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </PublicLayout>
  );
};

export default BlogPost;
