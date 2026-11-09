import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/shared/components/ui/button";
import PublicLayout from "@/web/components/PublicLayout";
import { track } from "@/shared/lib/analytics";
import { type PlanKey } from "@/shared/config/tiers";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import { LANDING_META, landingDescription, landingFaqs } from "@/shared/lib/publicCopy";
import { LandingHero, LandingExperience, LandingProblem, LandingOrigin, LandingWhy, LandingPlans, LandingFinal } from "@/web/components/LandingSections";
import { hapticTap } from "@/shared/lib/native";


const legacySections: Record<string, string> = {
  "#pricing": "/planes", "#planes": "/planes", "#ver-app": "/como-funciona#demo",
  "#como-funciona": "/como-funciona", "#equipo": "/equipo", "#faq": "/preguntas-frecuentes",
};

export default function Index() {
  const { hash, search } = useLocation();
  const navigate = useNavigate();
  const pricingRef = useRef<HTMLElement>(null);
  const plans = usePlanAvailability();
  const faqs = landingFaqs(plans);
  const destination = legacySections[hash];
  useEffect(() => { if (!destination) track("landing_view"); }, [destination]);
  useEffect(() => {
    const el = pricingRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { track("pricing_view", { source: "landing" }); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [destination]);
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [finalVisible, setFinalVisible] = useState(false);
  // Secciones que ya tienen su propio botón principal: con la barra fija encima,
  // tapaba la pantalla de la demo y el botón de las guías.
  const [ownCtaInView, setOwnCtaInView] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = ["demo", "guias"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!targets.length) return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setOwnCtaInView(visible.size > 0);
    }, { rootMargin: "-15% 0px -15% 0px" });
    targets.forEach((target) => io.observe(target));
    return () => io.disconnect();
  }, [destination]);
  useEffect(() => {
    const el = finalCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setFinalVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [destination]);
  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [destination]);
  const selectPlan = (plan: PlanKey) => {
    track("plan_select", { plan, source: "landing" });
    navigate(plan === "free" ? "/onboarding" : `/signup?plan=${plan}`);
  };
  if (destination) {
    const [pathname, anchor] = destination.split("#");
    return <Navigate replace to={{ pathname, search, hash: anchor ? `#${anchor}` : "" }} />;
  }
  return <PublicLayout title={LANDING_META.title} description={landingDescription(plans)}>

    <Helmet>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Autopilot",
          serviceType: plans.coach
            ? "Entrenamiento y nutrición online personalizados, con atención personal del fundador en el plan Coach"
            : "Entrenamiento y nutrición online personalizados",
          provider: { "@type": "Organization", name: "Autopilot", url: "https://autopilotplan.com/" },
          areaServed: { "@type": "Country", name: "España" },
          offers: plans.plans.map((p) => ({ "@type": "Offer", name: p.name, price: String(p.price), priceCurrency: "EUR", url: "https://autopilotplan.com/planes" })),
        })}</script>
<script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Autopilot",
          url: "https://autopilotplan.com/",
          description: plans.coach
            ? "App de entrenamiento y nutrición que se adapta a tu progreso, con análisis corporal por IA y atención personal del fundador en el plan Coach, para toda España."
            : "App de entrenamiento y nutrición que se adapta a tu progreso, con análisis corporal por IA, para toda España.",
          founder: { "@type": "Person", name: "Nicolás San Marcos" },
          logo: "https://autopilotplan.com/pwa-512.png",
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
    <LandingHero ctaRef={heroCtaRef} />
    <LandingExperience />
    <LandingProblem />
    <LandingOrigin />
    <LandingWhy />
    <LandingPlans onSelect={selectPlan} innerRef={pricingRef} />
    <LandingFinal innerRef={finalCtaRef} />

    {/* CTA fija en móvil cuando el quiz del hero ya no se ve */}
    {showSticky && !finalVisible && !ownCtaInView && <div className="fixed inset-x-0 bottom-0 z-40 bg-background/90 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur sm:hidden animate-in slide-in-from-bottom-full duration-300">
      <Button variant="hero" size="lg" asChild className="w-full"><Link to="/onboarding" onClick={() => { void hapticTap(); track("cta_click", { cta: "free_signup", source: "sticky" }); }}>Empezar gratis</Link></Button>
    </div>}
  </PublicLayout>;
}
