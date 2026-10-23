/**
 * Build-time SEO for a client-rendered SPA.
 *
 * Crawlers that don't run JavaScript (Bing, most AI assistants, link previews) used to get an
 * empty page. After `vite build` this plugin writes `dist/<route>/index.html` for every public
 * route with its own <title>, description, canonical, Open Graph, JSON-LD and the page's real
 * text inside #root. React replaces that content on load (createRoot), so users see the same app.
 *
 * Plan-dependent copy (Coach on/off) comes from the same `get_consumer_plans_public` RPC the app
 * uses, fetched at build time. If the network is unavailable the static tiers in src/config are used.
 * The plan snapshot is also injected as VITE_PLAN_SNAPSHOT so the app's first paint matches.
 */
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { loadEnv } from "vite";
import { availabilityFrom, euro, fallbackCatalog, parseCatalog, type CatalogPlan, type PlanAvailability } from "../src/shared/lib/planCatalogCore";
import { LANDING_META, OG_IMAGE, SITE_NAME, SITE_URL, landingDescription, landingFaqs, publicFaqs, publicPageMeta, type Faq } from "../src/shared/lib/publicCopy";
import { LEGAL_DOCS, LEGAL_LAST_UPDATED } from "../src/shared/content/legal";
import { socialLinkList } from "../src/shared/lib/socialLinks";

type BlogPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  body_markdown: string | null;
  cover_url: string | null;
  author_name: string | null;
  published_at: string | null;
  updated_at?: string | null;
};

type Route = {
  path: string;
  title: string;
  description: string;
  body: string;
  jsonLd?: object[];
  ogType?: "website" | "article";
  image?: string;
  priority: number;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  lastmod?: string;
};

// ───────────────────────────────────────────── helpers

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ld = (o: object) => `<script type="application/ld+json" data-prerender>${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const a = (href: string, text: string) => `<a href="${esc(href)}">${esc(text)}</a>`;
const p = (text: string) => `<p>${esc(text)}</p>`;
const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
const today = () => new Date().toISOString().slice(0, 10);

const faqHtml = (faqs: Faq[]) => faqs.map((f) => `<h3>${esc(f.q)}</h3>${p(f.a)}`).join("");
const faqLd = (faqs: Faq[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});
const breadcrumbs = (items: [string, string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${href}` })),
});

/** Minimal Markdown → HTML for blog bodies (headings, lists, emphasis, links, paragraphs). */
export function markdownToHtml(md: string): string {
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, href) => `<a href="${href}">${text}</a>`);
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const li = /^[-*+]\s+(.*)$/.exec(line);
    const oli = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line) { flushPara(); closeList(); continue; }
    if (h) { flushPara(); closeList(); const lvl = Math.min(6, Math.max(2, h[1].length)); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
    if (li || oli) {
      flushPara();
      const kind = li ? "ul" : "ol";
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((li || oli)![1])}</li>`);
      continue;
    }
    if (line.startsWith(">")) { flushPara(); closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`); continue; }
    closeList();
    para.push(line);
  }
  flushPara(); closeList();
  return out.join("\n");
}

const plainText = (md: string) => md.replace(/[#>*_`[\]()-]/g, " ").replace(/\s+/g, " ").trim();
const clip = (s: string, n = 158) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);

// ───────────────────────────────────────────── data (build time, best effort)

type Env = Record<string, string>;

async function rest<T>(env: Env, pathAndQuery: string, init?: RequestInit): Promise<T | null> {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof fetch !== "function") return null;
  try {
    const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const fetchPlanRows = (env: Env) => rest<unknown[]>(env, "rpc/get_consumer_plans_public", { method: "POST", body: "{}" });
const fetchPosts = (env: Env) =>
  rest<BlogPost[]>(env, "blog_posts?select=slug,title,excerpt,seo_title,seo_description,body_markdown,cover_url,author_name,published_at,updated_at&published=eq.true&order=published_at.desc");

// ───────────────────────────────────────────── shared blocks

const NAV = `<nav aria-label="Navegación principal">${[
  ["/", "Inicio"], ["/como-funciona", "Cómo funciona"], ["/planes", "Planes"], ["/equipo", "Equipo"],
  ["/recursos", "Recursos"], ["/blog", "Blog"], ["/preguntas-frecuentes", "Dudas"], ["/onboarding", "Crear mi rutina gratis"],
].map(([h, t]) => a(h, t)).join(" · ")}</nav>`;

const FOOTER = `<footer><p>Autopilot · App de entrenamiento y nutrición en español · España</p><p>${[
  ["/legal/aviso-legal", "Aviso legal"], ["/legal/terminos", "Términos"], ["/legal/privacidad", "Privacidad"],
  ["/legal/cookies", "Cookies"], ["/legal/disclaimer-medico", "Información de salud"], ["/connect", "Conectar con IA"],
].map(([h, t]) => a(h, t)).join(" · ")}</p></footer>`;

const page = (inner: string) => `<header>${a("/", "Autopilot")}${NAV}</header><main id="contenido">${inner}</main>${FOOTER}`;

const planList = (plans: CatalogPlan[]) =>
  plans.map((t) => `<article><h3>${esc(t.name)} — ${t.price === 0 ? "Gratis" : `${esc(euro(t.price))}/mes`}</h3>${p(t.tagline)}${ul(t.features)}${
    t.price > 0 && t.trial_days > 0 ? p(`${t.trial_days} días de prueba. Después ${euro(t.price)}/mes con renovación automática; cancela desde Ajustes → Suscripción.`) : t.price === 0 ? p("Sin tarjeta ni caducidad.") : ""
  }</article>`).join("");

let SAME_AS: string[] = [];
const organizationLd = (av: PlanAvailability) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/pwa-512.png`,
  description: av.coach
    ? "App de entrenamiento y nutrición que se adapta a tu progreso, con atención personal del fundador en el plan Coach."
    : "App de entrenamiento y nutrición que se adapta a tu progreso.",
  founder: { "@type": "Person", name: "Nicolás San Marcos", jobTitle: "Fundador y desarrollador" },
  areaServed: { "@type": "Country", name: "España" },
  ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
});

const appLd = (av: PlanAvailability) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  applicationCategory: "HealthApplication",
  operatingSystem: "Web, iOS, Android",
  inLanguage: "es-ES",
  description: "Crea tu rutina de gimnasio, casa o calistenia según tu objetivo, días y material, registra cada serie y sigue tu progreso.",
  offers: av.plans.map((t) => ({ "@type": "Offer", name: t.name, price: String(t.price), priceCurrency: "EUR", url: `${SITE_URL}/planes` })),
  publisher: { "@id": `${SITE_URL}/#organization` },
});

// ───────────────────────────────────────────── routes

function buildRoutes(av: PlanAvailability, posts: BlogPost[]): Route[] {
  const meta = publicPageMeta(av);
  const paidLine = [av.plus && `${av.plusName} te dice qué comer y cuánto peso subir.`, av.coach && `${av.coachName} añade a Nicolás revisando tu plan.`].filter(Boolean).join(" ");
  const lFaqs = landingFaqs(av);
  const pFaqs = publicFaqs(av);

  const routes: Route[] = [
    {
      path: "/",
      title: `${LANDING_META.title} · ${SITE_NAME}`,
      description: landingDescription(av),
      priority: 1,
      changefreq: "weekly",
      jsonLd: [
        organizationLd(av),
        { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: `${SITE_URL}/`, inLanguage: "es-ES", publisher: { "@id": `${SITE_URL}/#organization` } },
        appLd(av),
        faqLd(lFaqs),
      ],
      body: page(`
        <h1>Entrena con plan. Registra cada serie. Mira cómo progresas.</h1>
        ${p("Tu rutina según tu objetivo, tus días y tu material. En el gimnasio o en casa.")}
        <p>${a("/onboarding", "Crear mi rutina gratis")} · ${a("/como-funciona#demo", "Probar la demo")}</p>
        ${p("Free sin tarjeta y sin caducidad · Web y móvil")}
        <section><h2>Empieza gratis. Paga solo si te aporta.</h2>${p(`Gratis: crea tu rutina, registra tus entrenamientos y sigue tu progreso. ${paidLine}`)}${planList(av.plans)}<p>${a("/planes", "Ver la comparativa completa")}</p></section>
        <section><h2>Cómo funciona</h2><ol>
          <li><h3>Personaliza</h3>${p("Objetivo, nivel, días, lesiones y material: gimnasio, casa o calistenia.")}</li>
          <li><h3>Entrena</h3>${p("Sigue tu sesión y apunta kg y repeticiones de cada serie.")}</li>
          <li><h3>Progresa</h3>${p(`Consulta récords, volumen y peso.${av.plus ? ` En ${av.plusName}, la carga siguiente se calcula con tus registros.` : ""}`)}</li>
        </ol>${p("La rutina y la progresión usan reglas de entrenamiento fijas y comprobables. La IA se usa donde aporta: el análisis corporal por foto y el asistente de dudas.")}</section>
        <section><h2>Quién está detrás</h2>${p(`Soy Nicolás San Marcos, fundador y desarrollador de Autopilot. Lo construyo yo${av.coach ? `, y en el plan ${av.coachName} también soy yo quien revisa tu plan y te responde por chat` : ""}. Quería una app que te diga qué hacer hoy sin complicarte.`)}</section>
        <section><h2>Dudas frecuentes</h2>${faqHtml(lFaqs)}<p>${a("/preguntas-frecuentes", "Ver todas las dudas")}</p></section>
        <section><h2>Empieza a entrenar con Autopilot</h2>${p("Gratis y sin tarjeta.")}<p>${a("/onboarding", "Crear mi rutina gratis")}</p></section>`),
    },
    {
      path: "/planes",
      title: `${meta.plans.title} · ${SITE_NAME}`,
      description: meta.plans.description,
      priority: 0.9,
      changefreq: "monthly",
      jsonLd: [breadcrumbs([["Inicio", "/"], [meta.plans.title, "/planes"]]), appLd(av)],
      body: page(`<h1>${esc(meta.plans.title)}</h1>${p(meta.plans.description)}${planList(av.plans)}
        ${p(`Free no caduca y no pide tarjeta.${av.plus || av.coach ? ` ${av.paidNames} ${av.plus && av.coach ? "piden" : "pide"} tarjeta al empezar la prueba de 7 días; el primer cobro llega el día 8 si no cancelas. Sin permanencia.` : ""}`)}
        ${av.plus || av.coach ? p("Garantía de devolución de 30 días en planes mensuales.") : ""}
        <p>${a("/legal/terminos", "Condiciones de prueba, cancelación y devolución")} · ${a("/preguntas-frecuentes", "Resolver dudas")}</p>`),
    },
    {
      path: "/como-funciona",
      title: `${meta.how.title} · ${SITE_NAME}`,
      description: meta.how.description,
      priority: 0.8,
      changefreq: "monthly",
      jsonLd: [
        breadcrumbs([["Inicio", "/"], [meta.how.title, "/como-funciona"]]),
        {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "Cómo crear tu rutina de entrenamiento con Autopilot",
          inLanguage: "es-ES",
          step: [
            { "@type": "HowToStep", name: "Cuéntanos tu objetivo", text: "Indica tu nivel, el material y los días que puedes entrenar." },
            { "@type": "HowToStep", name: "Crea tu rutina", text: "Autopilot construye la rutina gratis con ejercicios que puedes hacer." },
            { "@type": "HowToStep", name: "Registra y progresa", text: "Guarda tus series y compara tus entrenamientos para ver cómo avanzas." },
          ],
        },
      ],
      body: page(`<h1>${esc(meta.how.title)}</h1>${p(meta.how.description)}<ol>
        <li><h2>Cuéntanos tu objetivo</h2>${p("Indica tu nivel, el material y los días que puedes entrenar.")}</li>
        <li><h2>Crea tu rutina</h2>${p(`Empieza gratis.${av.plus ? ` Si quieres nutrición y progresión de cargas automática, elige ${av.plusName}.` : ""}${av.coach ? ` ${av.coachName} añade a Nicolás revisando tu plan.` : ""}`)}</li>
        <li><h2>Registra y progresa</h2>${p("Guarda tus series y compara tus entrenamientos para ver cómo avanzas.")}</li></ol>
        <p>${a("/scan", "Hacer el análisis inicial con IA")} · ${a("/onboarding", "Crear mi rutina gratis")}</p>`),
    },
    {
      path: "/equipo",
      title: `${meta.team.title} · ${SITE_NAME}`,
      description: meta.team.description,
      priority: 0.6,
      changefreq: "monthly",
      jsonLd: [
        breadcrumbs([["Inicio", "/"], [meta.team.title, "/equipo"]]),
        { "@context": "https://schema.org", "@type": "Person", name: "Nicolás San Marcos", jobTitle: "Fundador y desarrollador de Autopilot", worksFor: { "@id": `${SITE_URL}/#organization` } },
      ],
      body: page(`<h1>${esc(meta.team.title)}</h1>${p(meta.team.description)}
        ${p(`Nicolás San Marcos es el fundador y desarrollador de Autopilot.${av.coach ? ` En el plan ${av.coachName}, revisa tu plan y te responde por chat en horario normal, no 24/7.` : ""}`)}`),
    },
    {
      path: "/preguntas-frecuentes",
      title: `${meta.faq.title} · ${SITE_NAME}`,
      description: meta.faq.description,
      priority: 0.8,
      changefreq: "monthly",
      jsonLd: [breadcrumbs([["Inicio", "/"], [meta.faq.title, "/preguntas-frecuentes"]]), faqLd(pFaqs)],
      body: page(`<h1>${esc(meta.faq.title)}</h1>${faqHtml(pFaqs)}`),
    },
    {
      path: "/scan",
      title: "Análisis corporal gratis con IA · Autopilot",
      description: "Sube una foto y recibe un análisis estimado por IA de tu físico, con lo que más te limita y por dónde empezar. Gratis y sin tarjeta.",
      priority: 0.8,
      changefreq: "monthly",
      jsonLd: [breadcrumbs([["Inicio", "/"], ["Análisis corporal con IA", "/scan"]])],
      body: page(`<h1>Análisis corporal gratis con IA</h1>${p("Sube una foto y recibe un análisis visual estimado por IA: tu punto de partida, lo que más te limita ahora y por dónde empezar. Es gratis, sin tarjeta y sin crear cuenta.")}${p("El análisis es orientativo y no sustituye el consejo de un profesional sanitario.")}<p>${a("/legal/disclaimer-medico", "Información de salud")}</p>`),
    },
    {
      path: "/recursos",
      title: "Recursos: guías y artículos de entrenamiento · Autopilot",
      description: "Guías en PDF, recomendaciones y artículos sobre entrenamiento, nutrición e hipertrofia seleccionados por Autopilot.",
      priority: 0.6,
      changefreq: "weekly",
      body: page(`<h1>Recursos</h1>${p("Guías, recomendaciones y artículos sobre entrenamiento y nutrición.")}${posts.length ? `<h2>Artículos</h2><ul>${posts.slice(0, 12).map((x) => `<li>${a(`/blog/${x.slug}`, x.title)}</li>`).join("")}</ul>` : ""}`),
    },
    {
      path: "/blog",
      title: "Blog de entrenamiento, nutrición e hipertrofia · Autopilot",
      description: "Guías prácticas en español sobre entrenamiento de fuerza, hipertrofia, nutrición y progreso en el gimnasio o en casa.",
      priority: 0.7,
      changefreq: "weekly",
      jsonLd: [
        breadcrumbs([["Inicio", "/"], ["Blog", "/blog"]]),
        { "@context": "https://schema.org", "@type": "Blog", name: "Blog de Autopilot", url: `${SITE_URL}/blog`, inLanguage: "es-ES", publisher: { "@id": `${SITE_URL}/#organization` } },
      ],
      body: page(`<h1>Blog de Autopilot</h1>${p("Guías prácticas sobre entrenamiento, nutrición e hipertrofia.")}${posts.map((x) => `<article><h2>${a(`/blog/${x.slug}`, x.title)}</h2>${x.excerpt ? p(x.excerpt) : ""}</article>`).join("")}`),
    },
    {
      path: "/connect",
      title: "Conectar Autopilot con ChatGPT o Claude (MCP) · Autopilot",
      description: "Conecta Autopilot a ChatGPT o Claude para consultar tu plan de entrenamiento y nutrición desde tu asistente.",
      priority: 0.4,
      changefreq: "monthly",
      body: page(`<h1>Conecta Autopilot a tu asistente de IA</h1>${p("Conecta Autopilot a ChatGPT o Claude mediante MCP para consultar tu plan de entrenamiento y nutrición desde tu asistente favorito.")}`),
    },
  ];

  for (const [slug, doc] of Object.entries(LEGAL_DOCS)) {
    routes.push({
      path: `/legal/${slug}`,
      title: `${doc.title} · ${SITE_NAME}`,
      description: clip(doc.summary),
      priority: 0.3,
      changefreq: "yearly",
      body: page(`<h1>${esc(doc.title)}</h1>${p(doc.summary)}${p(`Última actualización: ${LEGAL_LAST_UPDATED}`)}${doc.sections
        .map((s) => `${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}${(s.paragraphs || []).map(p).join("")}${s.list ? ul(s.list) : ""}`)
        .join("")}`),
    });
  }

  for (const post of posts) {
    if (!post.slug || !/^[a-z0-9-]+$/i.test(post.slug)) continue;
    const description = clip(post.seo_description || post.excerpt || plainText(post.body_markdown || ""));
    const title = post.seo_title || post.title;
    routes.push({
      path: `/blog/${post.slug}`,
      title: `${title} · ${SITE_NAME}`,
      description,
      ogType: "article",
      image: post.cover_url || undefined,
      priority: 0.6,
      changefreq: "monthly",
      lastmod: (post.updated_at || post.published_at || "").slice(0, 10) || undefined,
      jsonLd: [
        breadcrumbs([["Inicio", "/"], ["Blog", "/blog"], [post.title, `/blog/${post.slug}`]]),
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description,
          inLanguage: "es-ES",
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
          image: post.cover_url || OG_IMAGE,
          datePublished: post.published_at || undefined,
          dateModified: post.updated_at || post.published_at || undefined,
          author: { "@type": "Person", name: post.author_name || "Nicolás San Marcos" },
          publisher: { "@id": `${SITE_URL}/#organization` },
        },
      ],
      body: page(`<article><h1>${esc(post.title)}</h1>${post.author_name ? p(`Por ${post.author_name}`) : ""}${post.excerpt ? p(post.excerpt) : ""}${markdownToHtml(post.body_markdown || "")}</article><p>${a("/blog", "Más artículos")} · ${a("/onboarding", "Crear mi rutina gratis")}</p>`),
    });
  }
  return routes;
}

// ───────────────────────────────────────────── HTML writing

/** Head tags owned by each route; stripped from the template and re-added per page. */
const OWNED_HEAD = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\s+name="description"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
  /<meta\s+property="og:(title|description|url|type|image)"[^>]*>\s*/gi,
  /<meta\s+name="twitter:(title|description|image)"[^>]*>\s*/gi,
  /<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi,
];

const CONTENT_MARKER = "<!--prerender:content-->";

export function renderRoute(template: string, r: Route): string {
  let html = template;
  for (const re of OWNED_HEAD) html = html.replace(re, "");
  const url = `${SITE_URL}${r.path === "/" ? "/" : r.path}`;
  const image = r.image || OG_IMAGE;
  const head = [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.description)}" data-prerender>`,
    `<link rel="canonical" href="${url}" data-prerender>`,
    `<meta property="og:type" content="${r.ogType || "website"}" data-prerender>`,
    `<meta property="og:title" content="${esc(r.title)}" data-prerender>`,
    `<meta property="og:description" content="${esc(r.description)}" data-prerender>`,
    `<meta property="og:url" content="${url}" data-prerender>`,
    `<meta property="og:image" content="${esc(image)}" data-prerender>`,
    `<meta name="twitter:title" content="${esc(r.title)}" data-prerender>`,
    `<meta name="twitter:description" content="${esc(r.description)}" data-prerender>`,
    `<meta name="twitter:image" content="${esc(image)}" data-prerender>`,
    ...(r.jsonLd || []).map(ld),
  ].join("\n    ");
  html = html.replace("</head>", `    ${head}\n  </head>`);
  // Real content inside #root; the splash stays on top until React mounts and replaces everything.
  // Vite moves the entry <script> into <head> when building, so anchor on a marker, not on the script.
  const content = `<div data-prerender-content>${r.body}</div>`;
  if (html.includes(CONTENT_MARKER)) html = html.replace(CONTENT_MARKER, content);
  else html = html.replace(/<div id="root">/, (open) => `${open}${content}`);
  return html;
}

function sitemap(routes: Route[]): string {
  const built = today();
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((r) => `  <url>
    <loc>${SITE_URL}${r.path === "/" ? "/" : r.path}</loc>
    <lastmod>${r.lastmod || built}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`).join("\n")}
</urlset>
`;
}

const ROBOTS = `# Autopilot — autopilotplan.com
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /settings
Disallow: /trainer
Disallow: /drive
Disallow: /my-schedule
Disallow: /impersonate/
Disallow: /payment-success
Disallow: /reset-password
Disallow: /unsubscribe
Disallow: /d/
Disallow: /invitacion/
Disallow: /.lovable/

# Buscadores y asistentes de IA: bienvenidos a las páginas públicas.
User-agent: Googlebot
User-agent: Bingbot
User-agent: Google-Extended
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Applebot
User-agent: Applebot-Extended
User-agent: DuckAssistBot
User-agent: Meta-ExternalAgent
User-agent: CCBot
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /settings
Disallow: /trainer
Disallow: /drive

Sitemap: ${SITE_URL}/sitemap.xml
`;

function llms(av: PlanAvailability, routes: Route[], full: boolean, posts: BlogPost[]): string {
  const plans = av.plans.map((t) => `- **${t.name}** — ${t.price === 0 ? "gratis, sin tarjeta y sin caducidad" : `${euro(t.price)}/mes${t.trial_days ? `, ${t.trial_days} días de prueba` : ""}`}: ${t.features.join("; ")}.`).join("\n");
  const pages = routes
    .filter((r) => !r.path.startsWith("/blog/") && !r.path.startsWith("/legal/"))
    .map((r) => `- [${r.title.replace(/ · Autopilot$/, "")}](${SITE_URL}${r.path}): ${r.description}`)
    .join("\n");
  const blog = posts.slice(0, full ? posts.length : 15).map((x) => `- [${x.title}](${SITE_URL}/blog/${x.slug})${x.excerpt ? `: ${x.excerpt}` : ""}`).join("\n");
  const faq = publicFaqs(av).map((f) => `### ${f.q}\n${f.a}`).join("\n\n");
  return `# Autopilot

> Autopilot (autopilotplan.com) es una app web y móvil en español para crear tu rutina de entrenamiento según tu objetivo, días y material (gimnasio, casa o calistenia), registrar cada serie y seguir tu progreso. El plan Free es gratis, sin tarjeta y sin caducidad.${av.plus ? ` ${av.plusName} añade plan de nutrición y progresión de cargas calculada con tus registros.` : ""}${av.coach ? ` ${av.coachName} añade a Nicolás San Marcos, el fundador, revisando tu plan y respondiendo por chat.` : ""}

Creada y mantenida por Nicolás San Marcos (fundador y desarrollador), España. La rutina y la progresión usan reglas de entrenamiento fijas; la IA se usa para el análisis corporal por foto y el asistente de dudas. No sustituye el consejo médico.

## Planes

${plans}

${av.plus || av.coach ? `Los planes de pago piden tarjeta al empezar 7 días de prueba; el primer cobro llega el día 8 si no se cancela desde Ajustes → Suscripción. Sin permanencia. Garantía de devolución de 30 días en planes mensuales.\n\n` : ""}## Páginas

${pages}
${blog ? `\n## Blog\n\n${blog}\n` : ""}${full ? `\n## Preguntas frecuentes\n\n${faq}\n` : ""}
## Optional

- [Términos](${SITE_URL}/legal/terminos): condiciones del servicio, prueba, cancelación y devolución.
- [Privacidad](${SITE_URL}/legal/privacidad): RGPD y LOPDGDD.
- [Información de salud](${SITE_URL}/legal/disclaimer-medico): aviso médico.
${full ? "" : `- [Versión completa para IA](${SITE_URL}/llms-full.txt)\n`}`;
}

// ───────────────────────────────────────────── plugin

export function seoPrerender(): Plugin {
  let env: Env = {};
  let rows: unknown[] | null = null;
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "autopilot-seo-prerender",
    apply: "build",
    async config(_config, { mode }) {
      env = { ...loadEnv(mode, process.cwd(), ""), ...(process.env as Env) };
      rows = await fetchPlanRows(env);
      if (!rows?.length) return {};
      // Same catalog for the first paint of the app as for the prerendered HTML.
      return { define: { "import.meta.env.VITE_PLAN_SNAPSHOT": JSON.stringify(JSON.stringify(rows)) } };
    },
    configResolved(c) {
      outDir = c.build.outDir;
      root = c.root;
    },
    async closeBundle() {
      const dist = path.resolve(root, outDir);
      const indexPath = path.join(dist, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const template = fs.readFileSync(indexPath, "utf8");
      const catalog = rows?.length ? parseCatalog(rows) : fallbackCatalog();
      const av = availabilityFrom(catalog);
      const posts = (await fetchPosts(env)) || [];
      SAME_AS = socialLinkList(await rest<unknown>(env, "rpc/get_social_links_public", { method: "POST", body: "{}" })).map((l) => l.url);
      const routes = buildRoutes(av, posts);
      for (const r of routes) {
        const file = r.path === "/" ? indexPath : path.join(dist, r.path.slice(1), "index.html");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, renderRoute(template, r));
      }
      fs.writeFileSync(path.join(dist, "sitemap.xml"), sitemap(routes));
      fs.writeFileSync(path.join(dist, "robots.txt"), ROBOTS);
      fs.writeFileSync(path.join(dist, "llms.txt"), llms(av, routes, false, posts));
      fs.writeFileSync(path.join(dist, "llms-full.txt"), llms(av, routes, true, posts));
      console.log(`[seo] ${routes.length} páginas prerenderizadas · Coach ${av.coach ? "visible" : "oculto"} · ${posts.length} artículos · catálogo ${rows?.length ? "en vivo" : "estático"}`);
    },
  };
}

// Exposed for tests.
export const __test = { buildRoutes, sitemap, llms, ROBOTS, availabilityFrom, parseCatalog, fallbackCatalog };
