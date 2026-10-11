import { ArrowRight, Play } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/PublicLayout";
import { track } from "@/lib/analytics";
import { TIERS } from "@/config/tiers";
import dashboardPreview from "@/assets/dashboard-preview.png";

const legacySections: Record<string, string> = {
  "#pricing": "/planes", "#planes": "/planes", "#ver-app": "/como-funciona#demo",
  "#como-funciona": "/como-funciona", "#equipo": "/equipo", "#faq": "/preguntas-frecuentes",
};

export default function Index() {
  const { hash, search } = useLocation();
  const destination = legacySections[hash];
  useEffect(() => { if (!destination) track("landing_view"); }, [destination]);
  if (destination) {
    const [pathname, anchor] = destination.split("#");
    return <Navigate replace to={{ pathname, search, hash: anchor ? `#${anchor}` : "" }} />;
  }
  return <PublicLayout title="Crea tu rutina. Empieza gratis" description="Crea tu rutina, registra tus entrenamientos y sigue tu progreso. Empieza gratis y sin tarjeta; añade nutrición o entrenador cuando lo necesites.">
    <Helmet>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Entrenamiento y nutrición online con IA y, en el plan Coach, entrenador humano",
          provider: { "@type": "Organization", name: "Autopilot", url: "https://autopilotplan.com/" },
          areaServed: "ES",
          offers: [
            { "@type": "Offer", name: "Free", price: "0", priceCurrency: "EUR" },
            { "@type": "Offer", name: "Plus", price: "29", priceCurrency: "EUR" },
            { "@type": "Offer", name: "Coach", price: "49", priceCurrency: "EUR" },
          ],
        })}</script>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Autopilot",
          url: "https://autopilotplan.com/",
          description: "Entrenamiento y nutrición que se adaptan a tu progreso, con análisis inicial por IA y entrenador real en el plan Coach, para toda España.",
          areaServed: { "@type": "Country", name: "España" },
          address: { "@type": "PostalAddress", addressCountry: "ES" },
          availableLanguage: ["es"],
          contactPoint: [{ "@type": "ContactPoint", contactType: "Atención al cliente", availableLanguage: ["es"], areaServed: "ES" }],
        })}</script>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Autopilot",
          url: "https://autopilotplan.com/",
          inLanguage: "es-ES",
        })}</script>
    </Helmet>
    <section className="relative isolate flex min-h-[min(620px,calc(100svh-4rem))] items-center overflow-hidden px-5 py-8 sm:px-8 sm:py-16">
      <img src={dashboardPreview} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-right opacity-30" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/90 to-background/30" />
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-xl motion-safe:animate-fade-in">
          <p className="mb-5 font-display text-xl font-bold text-primary">Autopilot</p>
          <h1 className="font-display text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[1.02] tracking-tight">Crea tu rutina.<br /><span className="text-primary">Empieza gratis.</span></h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">Elige tus días. Entrena y guarda tu progreso.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button variant="hero" size="lg" asChild className="min-h-12"><Link to="/onboarding" onClick={() => track("cta_click", { cta: "free_signup", source: "hero" })}>Crear mi rutina gratis <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button variant="outline" size="lg" asChild className="min-h-12"><Link to="/como-funciona#demo" onClick={() => track("plan_preview_view", { source: "hero" })}><Play className="h-4 w-4" /> Ver la demo</Link></Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
            <span>Sin tarjeta</span><Link to="/planes" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver planes y precios</Link>
          </div>
        </div>
      </div>
    </section>
    <section aria-labelledby="explora" className="border-t border-border px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <h2 id="explora" className="font-display text-xl font-semibold">Lo que necesitas, a un clic</h2>
        <div className="mt-4 grid gap-x-10 sm:grid-cols-2">
          {[
            { to: "/planes", title: "Planes y precios", text: `Gratis · Plus ${TIERS.training.price} €/mes · Coach ${TIERS.full.price} €/mes` },
            { to: "/como-funciona", title: "Cómo funciona", text: "Conoce los pasos y prueba la app sin registrarte." },
            { to: "/equipo", title: "Conoce a tu equipo", text: "Quién te acompaña si eliges el plan Coach." },
            { to: "/recursos", title: "Guías y recursos", text: "Libros, artículos y recomendaciones." },
          ].map(item => <Link key={item.to} to={item.to} className="group flex min-h-20 min-w-0 items-center justify-between gap-4 border-b border-border py-4">
            <div className="min-w-0"><h3 className="font-medium transition-colors group-hover:text-primary">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.text}</p></div>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-primary transition-transform motion-safe:group-hover:translate-x-1" />
          </Link>)}
        </div>
      </div>
    </section>
  </PublicLayout>;
}
