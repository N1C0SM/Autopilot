import { Helmet } from "react-helmet-async";

interface PageHeadProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

const BASE = "https://autopilotplan.com";

/**
 * Per-route head metadata. Use on every route so titles, descriptions,
 * canonical and og:* tags are unique per page (avoids SEO duplication).
 */
export default function PageHead({ title, description, path, noindex }: PageHeadProps) {
  const url = `${BASE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex ? <meta name="robots" content="noindex,nofollow" /> : null}
    </Helmet>
  );
}