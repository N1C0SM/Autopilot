import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ExternalLink, ScanLine, Dumbbell, Beaker, LineChart, Shirt } from "lucide-react";

type Product = { title: string; description: string; image?: string; url: string };
type Category = { id: string; title: string; icon: typeof Dumbbell; blurb: string; items: Product[] };

const CATEGORIES: Category[] = [
  {
    id: "material",
    title: "Material de entreno",
    icon: Dumbbell,
    blurb: "Lo mínimo imprescindible para entrenar en casa con progresión real.",
    items: [
      { title: "Bandas de resistencia (set)", description: "Resistencia progresiva para pull-ups asistidos, glúteo y activación.", url: "#" },
      { title: "Barra de dominadas de puerta", description: "Sin taladrar. Para empezar a hacer tirones desde casa.", url: "#" },
      { title: "Esterilla técnica 10 mm", description: "Amortigua rodillas y lumbar en cualquier ejercicio de suelo.", url: "#" },
    ],
  },
  {
    id: "suplementacion",
    title: "Suplementación",
    icon: Beaker,
    blurb: "Lo que sí tiene evidencia. Sin humo, sin quemagrasas mágicos.",
    items: [
      { title: "Proteína whey aislada", description: "Para cerrar tu objetivo diario de proteína sin pasarte de calorías.", url: "#" },
      { title: "Creatina monohidrato", description: "El suplemento más estudiado. 3-5 g al día, sin ciclos.", url: "#" },
      { title: "Omega-3 (EPA/DHA)", description: "Salud cardiovascular y recuperación si no comes pescado azul.", url: "#" },
    ],
  },
  {
    id: "progreso",
    title: "Seguimiento de progreso",
    icon: LineChart,
    blurb: "Medir bien es entrenar mejor. Menos apps, más datos que sirven.",
    items: [
      { title: "Báscula de bioimpedancia", description: "Peso, % graso y agua corporal para seguir tendencia semanal.", url: "#" },
      { title: "Cinta métrica retráctil", description: "Cintura, cadera y brazo — la métrica más honesta del progreso.", url: "#" },
      { title: "Pulsómetro con banda pectoral", description: "Zonas de esfuerzo reales para cardio y HIIT.", url: "#" },
    ],
  },
  {
    id: "ropa",
    title: "Ropa técnica",
    icon: Shirt,
    blurb: "Ropa cómoda que no estorba y aguanta el gimnasio de casa.",
    items: [
      { title: "Camisetas técnicas dry-fit", description: "Ligeras, transpirables, sin marcar. Básico de entreno.", url: "#" },
      { title: "Shorts entrenamiento 7\"", description: "Rango completo para sentadilla y peso muerto sin tirones.", url: "#" },
      { title: "Zapatillas planas de entreno", description: "Suela plana para sentadilla y peso muerto — no runners.", url: "#" },
    ],
  },
];

const Recomendaciones = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Recomendaciones · Autopilot</title>
        <meta
          name="description"
          content="Material, suplementos, herramientas de progreso y ropa técnica que sí funcionan. Selección honesta del equipo de Autopilot."
        />
        <link rel="canonical" href="https://autopilotplan.com/recomendaciones" />
        <meta property="og:title" content="Recomendaciones · Autopilot" />
        <meta property="og:description" content="Lo que sí usamos: material, suplementos, seguimiento y ropa técnica." />
      </Helmet>

      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto max-w-6xl flex items-center justify-between h-14 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Volver
          </Button>
          <span className="font-display font-bold text-gradient">Recomendaciones</span>
          <span className="w-16" />
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-12 space-y-16">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-2">Selección honesta</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
            Lo que <span className="text-gradient">sí funciona</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            Cuatro categorías, doce productos. Sin humo, sin quemagrasas, sin gadgets inútiles.
          </p>
        </div>

        {CATEGORIES.map((cat) => (
          <section key={cat.id} id={cat.id} className="scroll-mt-20">
            <div className="mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <cat.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display leading-tight">{cat.title}</h2>
                <p className="text-xs text-muted-foreground">{cat.blurb}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cat.items.map((p) => (
                <article
                  key={p.title}
                  className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/40 transition-colors"
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-primary/10 to-secondary flex items-center justify-center">
                    {p.image ? (
                      <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <cat.icon className="w-10 h-10 text-primary/60" />
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-display font-bold leading-snug">{p.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed flex-1">{p.description}</p>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer sponsored"
                      className="mt-4 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Ver producto <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* CTA A DIAGNÓSTICO */}
        <section>
          <div className="relative rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card/60 to-card/60 p-8 sm:p-10 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative text-center max-w-2xl mx-auto">
              <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
                ¿Quieres ir un paso más allá?
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold font-display leading-tight mb-4">
                ¿Quieres un plan 100% personalizado <span className="text-gradient">en vez de una guía genérica?</span>
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Haz el diagnóstico gratuito con IA y un entrenador real lo convierte en un plan hecho para ti.
              </p>
              <Button variant="hero" size="xl" onClick={() => navigate("/scan")} className="hover-scale group">
                <ScanLine className="w-4 h-4" />
                Hacer mi diagnóstico gratis
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span><span className="font-display font-bold text-gradient">Autopilot</span> &copy; {new Date().getFullYear()}</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground">Inicio</Link>
            <Link to="/guia-entrenamiento-casa" className="hover:text-foreground">Guía en casa</Link>
            <Link to="/legal/terminos" className="hover:text-foreground">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Recomendaciones;