import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft } from "lucide-react";
import { LEGAL_DOCS, LEGAL_VERSION, LEGAL_LAST_UPDATED, type LegalSlug } from "@/content/legal";
import { hapticTap } from "@/lib/native";

const Legal = () => {
  const { slug } = useParams<{ slug: LegalSlug }>();
  const navigate = useNavigate();
  const key = (slug && slug in LEGAL_DOCS ? slug : "terminos") as LegalSlug;
  const doc = LEGAL_DOCS[key];
  const path = `/legal/${key}`;

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "var(--safe-bottom, 0px)" }}>
      <Helmet>
        <title>{`${doc.title} · Autopilot`}</title>
        <meta name="description" content={doc.summary} />
        <link rel="canonical" href={`https://autopilotplan.com${path}`} />
        <meta property="og:title" content={`${doc.title} · Autopilot`} />
        <meta property="og:description" content={doc.summary} />
        <meta property="og:url" content={`https://autopilotplan.com${path}`} />
        <meta name="robots" content="index,follow" />
      </Helmet>

      <header
        className="sticky top-0 z-10 flex h-12 items-center border-b border-border/60 bg-background/85 px-2 backdrop-blur-xl"
        style={{ paddingTop: "var(--safe-top, 0px)" }}
      >
        <button
          type="button"
          onClick={() => { void hapticTap(); navigate(-1); }}
          className="inline-flex h-10 items-center gap-0.5 rounded-full pl-1 pr-2.5 text-foreground/85 transition-colors active:bg-secondary/60"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[15px] font-medium">Atrás</span>
        </button>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-16 pt-8">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Información legal</p>
        <h1 className="mt-1 text-[34px] font-bold font-display leading-[1.05] tracking-[-0.035em]">{doc.title}</h1>
        <p className="mt-3 text-[15px] leading-snug text-muted-foreground">{doc.summary}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">Versión {LEGAL_VERSION} · Actualizado {LEGAL_LAST_UPDATED}</p>

        <article className="mt-8 space-y-7">
          {doc.sections.map((s, i) => (
            <section key={i}>
              {s.heading && <h2 className="mb-2 text-[20px] font-semibold font-display tracking-[-0.02em]">{s.heading}</h2>}
              {s.paragraphs?.map((p, j) => (
                <p key={j} className="mb-3 text-[16px] leading-relaxed text-foreground/85">{p}</p>
              ))}
              {s.list && (
                <ul className="space-y-2 pl-5 text-[16px] leading-relaxed text-foreground/85 list-disc marker:text-muted-foreground">
                  {s.list.map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              )}
            </section>
          ))}
        </article>

        <section className="mt-12">
          <h2 className="mb-2 pl-1 text-[13px] font-medium uppercase tracking-wider text-muted-foreground">Otros documentos</h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            {(Object.keys(LEGAL_DOCS) as LegalSlug[]).map((s, i) => (
              <Link
                key={s}
                to={`/legal/${s}`}
                onClick={() => void hapticTap()}
                className={`flex items-center justify-between px-4 py-3.5 text-[16px] transition-colors active:bg-secondary/50 ${i > 0 ? "border-t border-border/50" : ""} ${s === key ? "font-semibold text-primary" : "text-foreground"}`}
              >
                {LEGAL_DOCS[s].title}
                {s === key && <span className="text-[13px] text-muted-foreground">Leyendo</span>}
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-10 text-[12px] leading-relaxed text-muted-foreground">
          Este documento es un borrador adaptado al servicio actual de Autopilot. Antes de su publicación definitiva debe ser revisado por un abogado o tu Delegado de Protección de Datos (DPO).
        </p>
      </main>
    </div>
  );
};

export default Legal;
