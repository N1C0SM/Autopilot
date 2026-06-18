import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { LEGAL_DOCS, LEGAL_VERSION, LEGAL_LAST_UPDATED, type LegalSlug } from "@/content/legal";

const Legal = () => {
  const { slug } = useParams<{ slug: LegalSlug }>();
  const key = (slug && slug in LEGAL_DOCS ? slug : "terminos") as LegalSlug;
  const doc = LEGAL_DOCS[key];
  const path = `/legal/${key}`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${doc.title} · Autopilot`}</title>
        <meta name="description" content={doc.summary} />
        <link rel="canonical" href={`https://autopilotplan.com${path}`} />
        <meta property="og:title" content={`${doc.title} · Autopilot`} />
        <meta property="og:description" content={doc.summary} />
        <meta property="og:url" content={`https://autopilotplan.com${path}`} />
        <meta name="robots" content="index,follow" />
      </Helmet>

      <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="container mx-auto h-16 flex items-center justify-between px-4">
          <Link to="/" className="font-display text-xl font-bold text-gradient">Autopilot</Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Volver</Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <header className="mb-10">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">Información legal</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display leading-tight mb-3">{doc.title}</h1>
          <p className="text-muted-foreground">{doc.summary}</p>
          <p className="text-xs text-muted-foreground mt-3">
            Versión {LEGAL_VERSION} · Última actualización: {LEGAL_LAST_UPDATED}
          </p>
        </header>

        <article className="prose prose-invert max-w-none prose-headings:font-display prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-p:text-foreground/85 prose-li:text-foreground/85 prose-strong:text-foreground">
          {doc.sections.map((s, i) => (
            <section key={i}>
              {s.heading && <h2>{s.heading}</h2>}
              {s.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}
              {s.list && (
                <ul>
                  {s.list.map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              )}
            </section>
          ))}
        </article>

        <aside className="mt-14 p-5 border border-border rounded-2xl bg-card/40">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Otros documentos</p>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            {(Object.keys(LEGAL_DOCS) as LegalSlug[]).map((s) => (
              <li key={s}>
                <Link
                  to={`/legal/${s}`}
                  className={`block px-3 py-2 rounded-md transition-colors ${s === key ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                >
                  {LEGAL_DOCS[s].title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <p className="text-[11px] text-muted-foreground mt-10 leading-relaxed">
          Este documento es un borrador adaptado al servicio actual de Autopilot. Antes de su publicación definitiva debe ser revisado por un abogado o tu Delegado de Protección de Datos (DPO).
        </p>
      </main>
    </div>
  );
};

export default Legal;