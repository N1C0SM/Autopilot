import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { LEGAL_DOCS, LEGAL_VERSION, LEGAL_LAST_UPDATED, type LegalSlug } from "@/shared/content/legal";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import Screen from "@/shared/components/native/Screen";

const Legal = () => {
  const { slug } = useParams<{ slug: LegalSlug }>();
  const key = (slug && slug in LEGAL_DOCS ? slug : "terminos") as LegalSlug;
  const doc = LEGAL_DOCS[key];
  const path = `/legal/${key}`;

  return (
    <Screen title={doc.title} largeTitle maxWidth="reading">
      <Helmet>
        <title>{`${doc.title} · Autopilot`}</title>
        <meta name="description" content={doc.summary} />
        <link rel="canonical" href={`https://autopilotplan.com${path}`} />
        <meta property="og:title" content={`${doc.title} · Autopilot`} />
        <meta property="og:description" content={doc.summary} />
        <meta property="og:url" content={`https://autopilotplan.com${path}`} />
        <meta name="robots" content="index,follow" />
      </Helmet>

      <p className="type-subhead text-muted-foreground">{doc.summary}</p>
      <p className="mt-2 type-footnote text-muted-foreground">Versión {LEGAL_VERSION} · Actualizado {LEGAL_LAST_UPDATED}</p>

      <article className="selectable mt-8 space-y-8">
        {doc.sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h2 className="mb-3 type-title2">{s.heading}</h2>}
            {s.paragraphs?.map((p, j) => (
              <p key={j} className="mb-4 type-callout leading-relaxed last:mb-0">{p}</p>
            ))}
            {s.list && (
              <ul className="list-disc space-y-2 pl-5 type-callout leading-relaxed marker:text-muted-foreground">
                {s.list.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>

      <ListGroup header="Otros documentos" className="mt-14">
        {(Object.keys(LEGAL_DOCS) as LegalSlug[]).map((s) =>
          s === key ? (
            <ListRow key={s} title={<span className="text-primary">{LEGAL_DOCS[s].title}</span>} value="Leyendo" />
          ) : (
            <ListRow key={s} to={`/legal/${s}`} title={LEGAL_DOCS[s].title} chevron />
          ),
        )}
      </ListGroup>
    </Screen>
  );
};

export default Legal;
