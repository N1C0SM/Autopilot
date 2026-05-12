import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  Upload,
  ScanLine,
  Brain,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Zap,
  Target,
  Loader2,
  X,
  Lock,
  Users,
  Clock,
  AlertTriangle,
  Eye,
  Share2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Result = {
  attractiveness: number;
  potential: number;
  physique: number;
  style: number;
  similarity: number;
  estimated_months: number;
  improvements: { label: string; priority: "Alta" | "Media" | "Baja" }[];
  summary: string;
  percentile?: number;
  aesthetic_age?: number;
  months_without_plan?: number;
  months_with_plan?: number;
  headline_diagnosis?: string;
  bottleneck?: string;
  inferred_goal?: string;
  inferred_focus?: string;
  inferred_intensity?: number;
  inferred_specific_goals?: string[];
  locked_insights?: { label: string; teaser: string }[];
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const Dropzone = ({
  label,
  hint,
  image,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  image: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {image ? (
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-primary/30 bg-card">
          <img src={image} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent p-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              {label}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-card/40 transition-all flex flex-col items-center justify-center gap-3 p-6 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:scale-110 transition">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-xs text-muted-foreground mt-1">{hint}</div>
          </div>
        </button>
      )}
    </div>
  );
};

const ScoreCard = ({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) => (
  <div
    className={`relative bg-card/60 backdrop-blur rounded-2xl p-4 border ${
      highlight ? "border-primary/40 glow-shadow" : "border-border"
    }`}
  >
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
      {highlight && <Zap className="w-3 h-3 text-primary" />}
      {label}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-bold font-display text-gradient">
        {value.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground">/10</span>
    </div>
    <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-2">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value * 10}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full bg-gradient-to-r from-primary to-primary/60"
      />
    </div>
  </div>
);

const Scan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isPaid, setIsPaid] = useState(false);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [objectiveImg, setObjectiveImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [futureImg, setFutureImg] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("payment_status")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => setIsPaid(data?.payment_status === "paid"));
  }, [user]);

  const handleShare = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(shareRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "autopilot-scan.png", { type: "image/png" });

      const navAny = navigator as any;
      if (navAny.canShare?.({ files: [file] })) {
        try {
          await navAny.share({
            files: [file],
            title: "Mi AI Physique Scan",
            text: "Mi físico analizado por IA en autopilotplan.com/scan",
          });
          return;
        } catch {
          // fall through to download
        }
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "autopilot-scan.png";
      link.click();
      toast.success("Tarjeta descargada");
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo generar la tarjeta");
    } finally {
      setSharing(false);
    }
  };

  const generateFuture = async () => {
    if (!currentImg || !result) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-future-self", {
        body: {
          currentImage: currentImg,
          months: result.months_with_plan ?? result.estimated_months,
          goal: result.inferred_goal,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFutureImg(data.imageUrl);
    } catch (e: any) {
      toast.error(e?.message ?? "Error generando la simulación");
    } finally {
      setGenLoading(false);
    }
  };

  useEffect(() => {
    const prevTitle = document.title;
    const title = "AI Scan Autopilot Plan – Analiza tu físico con IA gratis";
    const description =
      "AI Scan de Autopilot Plan: sube una foto y la IA analiza tu físico, potencial y mejoras en 60 segundos. Gratis y sin registro.";
    document.title = title;

    const setMeta = (selector: string, attr: string, value: string, create?: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      if (!el && create) {
        el = create();
        document.head.appendChild(el);
      }
      if (el) el.setAttribute(attr, value);
      return el;
    };

    setMeta('meta[name="description"]', "content", description, () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      return m;
    });
    setMeta('meta[property="og:title"]', "content", title, () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:title");
      return m;
    });
    setMeta('meta[property="og:description"]', "content", description, () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:description");
      return m;
    });
    setMeta('meta[property="og:url"]', "content", "https://autopilotplan.com/scan", () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:url");
      return m;
    });
    setMeta('meta[name="twitter:title"]', "content", title, () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "twitter:title");
      return m;
    });
    setMeta('meta[name="twitter:description"]', "content", description, () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "twitter:description");
      return m;
    });

    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://autopilotplan.com/scan");

    const ldId = "scan-jsonld";
    let ld = document.getElementById(ldId) as HTMLScriptElement | null;
    if (!ld) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.id = ldId;
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Autopilot Plan AI Scan",
      url: "https://autopilotplan.com/scan",
      applicationCategory: "HealthApplication",
      description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    });

    return () => {
      document.title = prevTitle;
      document.getElementById(ldId)?.remove();
    };
  }, []);

  const handleAnalyze = async () => {
    if (!currentImg) {
      toast.error("Sube tu foto actual primero");
      return;
    }
    setLoading(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress((p) => Math.min(p + Math.random() * 8, 95));
    }, 300);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-physique", {
        body: { currentImage: currentImg, objectiveImage: objectiveImg },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setScanProgress(100);
      const r = data as Result;
      try {
        sessionStorage.setItem(
          "autopilot_scan",
          JSON.stringify({
            result: r,
            currentImg,
            objectiveImg,
            createdAt: Date.now(),
          })
        );
      } catch {}
      setTimeout(() => setResult(r), 400);

      // Auto-aplicar al plan si el usuario está pagado y logueado
      if (user && isPaid && (r.inferred_goal || r.inferred_focus || r.inferred_specific_goals?.length)) {
        applyScanToPlan(r);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error analizando la imagen");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const applyScanToPlan = async (r: Result) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from("onboarding")
        .select("id, specific_goal")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        // Sin onboarding previo no podemos generar plan (faltan edad/peso/etc.)
        return;
      }

      const updates: Record<string, any> = {};
      if (r.inferred_goal) updates.goal = r.inferred_goal;
      if (r.inferred_focus) {
        updates.primary_focus = r.inferred_focus;
        updates.equipment_type =
          r.inferred_focus === "gimnasio" ? "Gimnasio" :
          r.inferred_focus === "calistenia" ? "Calistenia" : "Mixto";
      }
      if (typeof r.inferred_intensity === "number") updates.intensity_level = r.inferred_intensity;
      if (r.inferred_specific_goals?.length) {
        updates.specific_goal = r.inferred_specific_goals.join(", ");
      }

      if (Object.keys(updates).length === 0) return;

      const { error: updErr } = await (supabase as any)
        .from("onboarding")
        .update(updates)
        .eq("user_id", user.id);
      if (updErr) throw updErr;

      await supabase.from("profiles").update({ plan_status: "plan_pending" }).eq("user_id", user.id);

      supabase.functions.invoke("generate-plan", { body: { user_id: user.id } });
      toast.success("Aplicando el scan a tu plan… se está regenerando 🎯");
    } catch (e: any) {
      console.error("applyScanToPlan", e);
      toast.error("No se pudo aplicar al plan automáticamente");
    }
  };

  const reset = () => {
    setResult(null);
    setCurrentImg(null);
    setObjectiveImg(null);
    setScanProgress(0);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[160px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="container mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            AI Scan · Gratis
          </span>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 pb-24">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center max-w-3xl mx-auto mb-12">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-[1.05] mb-4">
                  Analiza tu físico con{" "}
                  <span className="text-gradient">IA. Gratis.</span>
                </h1>
                <p className="text-lg text-muted-foreground">
                  Sube tu foto actual y opcionalmente un físico de referencia. La IA te dice qué te limita y cuánto te falta para llegar.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto mb-8">
                <Dropzone
                  label="Tu físico actual"
                  hint="Foto cuerpo completo · obligatoria"
                  image={currentImg}
                  onFile={async (f) => setCurrentImg(await fileToDataUrl(f))}
                  onClear={() => setCurrentImg(null)}
                />
                <Dropzone
                  label="Tu físico objetivo"
                  hint="Referencia (opcional)"
                  image={objectiveImg}
                  onFile={async (f) => setObjectiveImg(await fileToDataUrl(f))}
                  onClear={() => setObjectiveImg(null)}
                />
              </div>

              <div className="flex flex-col items-center gap-4">
                <Button
                  variant="hero"
                  size="xl"
                  onClick={handleAnalyze}
                  disabled={loading || !currentImg}
                  className="hover-scale group min-w-[280px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-1 animate-spin" />
                      Analizando... {Math.round(scanProgress)}%
                    </>
                  ) : (
                    <>
                      <ScanLine className="w-5 h-5 mr-1" />
                      Analizar mi físico
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    100% privado
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    Sin registro
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    60 segundos
                  </div>
                </div>
              </div>

              {loading && (
                <div className="max-w-md mx-auto mt-10">
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${scanProgress}%` }}
                      className="h-full bg-gradient-to-r from-primary to-primary/60"
                    />
                  </div>
                  <div className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-2">
                    <Brain className="w-3 h-3 text-primary animate-pulse" />
                    La IA está analizando tu composición, postura y proporciones...
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/30 bg-success/10 mb-4">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-success">
                    Análisis completo
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight mb-3">
                  Tu <span className="text-gradient">AI Physique Report</span>
                </h2>
                {result.headline_diagnosis ? (
                  <p className="text-lg sm:text-xl text-foreground max-w-2xl mx-auto font-medium leading-snug">
                    "{result.headline_diagnosis}"
                  </p>
                ) : (
                  <p className="text-muted-foreground max-w-2xl mx-auto">{result.summary}</p>
                )}
                <div className="mt-5 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    disabled={sharing}
                    className="hover-scale"
                  >
                    {sharing ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Share2 className="w-4 h-4 mr-1" />
                    )}
                    Compartir mi resultado
                  </Button>
                </div>
              </div>

              {/* HERO STATS — datos imposibles de ChatGPT */}
              {(result.percentile || result.aesthetic_age || result.months_with_plan) && (
                <div className="max-w-5xl mx-auto mb-8 grid sm:grid-cols-3 gap-3">
                  {result.percentile !== undefined && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-card/60 backdrop-blur border border-primary/30 rounded-2xl p-5 text-center glow-shadow"
                    >
                      <Users className="w-4 h-4 text-primary mx-auto mb-2" />
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                        Tu percentil
                      </div>
                      <div className="text-4xl font-bold font-display text-gradient">
                        Top {100 - result.percentile}%
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        vs hombres de tu edad
                      </div>
                    </motion.div>
                  )}
                  {result.aesthetic_age !== undefined && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-card/60 backdrop-blur border border-border rounded-2xl p-5 text-center"
                    >
                      <Eye className="w-4 h-4 text-primary mx-auto mb-2" />
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                        Edad estética
                      </div>
                      <div className="text-4xl font-bold font-display text-gradient">
                        {result.aesthetic_age}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        años percibidos
                      </div>
                    </motion.div>
                  )}
                  {result.months_with_plan !== undefined && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-card/60 backdrop-blur border border-primary/30 rounded-2xl p-5 text-center glow-shadow"
                    >
                      <Clock className="w-4 h-4 text-primary mx-auto mb-2" />
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                        A tu objetivo
                      </div>
                      <div className="text-4xl font-bold font-display text-gradient">
                        {result.months_with_plan}m
                      </div>
                      {result.months_without_plan !== undefined && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          vs <span className="line-through">{result.months_without_plan}m</span> sin plan
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {result.bottleneck && (
                <div className="max-w-3xl mx-auto mb-10">
                  <div className="bg-card/40 backdrop-blur border border-border rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
                        Lo que más te frena
                      </div>
                      <div className="text-sm font-medium">{result.bottleneck}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {/* Photos + similarity */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-border">
                      {currentImg && <img src={currentImg} alt="actual" className="w-full h-full object-cover" />}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Actual</div>
                      </div>
                    </div>
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-primary/40 glow-shadow">
                      {objectiveImg ? (
                        <img src={objectiveImg} alt="objetivo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-card flex items-center justify-center p-4 text-center">
                          <div className="text-xs text-muted-foreground">
                            Sube una foto de referencia para una comparación más precisa
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                        <div className="text-[10px] uppercase tracking-widest text-primary">Objetivo</div>
                      </div>
                    </div>
                  </div>
                  {objectiveImg && (
                    <div className="bg-card/60 backdrop-blur border border-primary/20 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2 text-xs">
                        <span className="text-muted-foreground">Similitud al objetivo</span>
                        <span className="font-bold text-primary">{result.similarity}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.similarity}%` }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-primary to-primary/60"
                        />
                      </div>
                      <div className="mt-3 text-[11px] text-muted-foreground">
                        Tiempo estimado:{" "}
                        <span className="text-foreground font-semibold">
                          ~{result.estimated_months} meses
                        </span>{" "}
                        con plan personalizado y constancia.
                      </div>
                    </div>
                  )}
                </div>

                {/* Scores + improvements */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <ScoreCard label="Atractivo" value={result.attractiveness} />
                    <ScoreCard label="Potencial" value={result.potential} highlight />
                    <ScoreCard label="Físico" value={result.physique} />
                    <ScoreCard label="Estilo" value={result.style} />
                  </div>

                  <div className="bg-card/60 backdrop-blur border border-border rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3" /> Mejoras detectadas
                    </div>
                    <ul className="space-y-2">
                      {result.improvements.map((m, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {m.label}
                          </span>
                          <span
                            className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              m.priority === "Alta"
                                ? "bg-primary/15 text-primary"
                                : m.priority === "Media"
                                ? "bg-secondary text-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {m.priority}
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  {/* Yo futuro bloqueado — gancho visceral */}
                  <div className="bg-card/60 backdrop-blur border border-primary/30 rounded-2xl p-4 relative overflow-hidden">
                    <div className="text-[10px] uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                      {isPaid ? <Sparkles className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      Tu yo en {result.months_with_plan ?? result.estimated_months} meses
                    </div>
                    <div className="relative aspect-[3/2] rounded-xl overflow-hidden bg-secondary">
                      {futureImg ? (
                        <img src={futureImg} alt="futuro IA" className="w-full h-full object-cover" />
                      ) : currentImg ? (
                        <img
                          src={currentImg}
                          alt="futuro"
                          className="w-full h-full object-cover scale-110"
                          style={{
                            filter: isPaid && !genLoading
                              ? "brightness(1.05) contrast(1.05)"
                              : "blur(18px) brightness(1.1) contrast(1.1)",
                          }}
                        />
                      ) : null}
                      {!futureImg && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                            {isPaid ? (
                              <>
                                <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur border border-primary/40 flex items-center justify-center">
                                  {genLoading ? (
                                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                  ) : (
                                    <Sparkles className="w-5 h-5 text-primary" />
                                  )}
                                </div>
                                <Button
                                  variant="hero"
                                  size="sm"
                                  onClick={generateFuture}
                                  disabled={genLoading}
                                >
                                  {genLoading ? "Generando con IA..." : "Generar simulación IA"}
                                </Button>
                                <div className="text-[11px] text-muted-foreground max-w-xs">
                                  Tarda ~15s. Misma identidad, físico transformado.
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur border border-primary/40 flex items-center justify-center">
                                  <Lock className="w-5 h-5 text-primary" />
                                </div>
                                <div className="text-sm font-semibold">Visualiza tu transformación</div>
                                <div className="text-[11px] text-muted-foreground max-w-xs">
                                  Simulación generada con IA al activar tu plan
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!isPaid && result.locked_insights && result.locked_insights.length > 0 && (
                    <div className="bg-card/60 backdrop-blur border border-primary/20 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                        <Lock className="w-3 h-3" /> Bloqueado · Plan completo
                      </div>
                      <ul className="space-y-2">
                        {result.locked_insights.map((li, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between text-sm bg-background/40 rounded-lg px-3 py-2 border border-border"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{li.label}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{li.teaser}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => navigate(user ? "/dashboard" : "/signup?from=scan")}
                              className="text-[10px] uppercase tracking-wider text-primary hover:underline flex-shrink-0 ml-2"
                            >
                              Desbloquear →
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* FUNNEL CTA */}
              {!isPaid ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="relative max-w-4xl mx-auto mt-16"
              >
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent rounded-3xl blur-2xl opacity-70" />
                <div className="relative bg-card/80 backdrop-blur-xl border border-primary/30 rounded-3xl p-8 sm:p-12 text-center overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
                  <div className="relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-5">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                        Siguiente paso
                      </span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display leading-[1.05] mb-4">
                      Llega ahí en{" "}
                      <span className="text-gradient">
                        {result.months_with_plan ?? result.estimated_months} meses
                      </span>
                      , no en {result.months_without_plan ?? Math.max((result.months_with_plan ?? result.estimated_months) * 3, 24)}
                    </h3>
                    <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                      La IA detectó {result.improvements.length} puntos críticos y tu cuello de botella exacto.
                      Te montamos el plan de entrenamiento + nutrición que los ataca, ajustado a ti. Sin él, dentro de 6 meses
                      estarás haciéndote el mismo scan con el mismo resultado.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        variant="hero"
                        size="xl"
                        onClick={() => navigate(user ? "/dashboard" : "/signup?from=scan")}
                        className="hover-scale group"
                      >
                        {user ? "Volver a mi cuenta" : "Empezar mi plan"}
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                      <Button variant="outline" size="xl" onClick={reset}>
                        Hacer otro scan
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 mt-6 justify-center text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        7 días gratis
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        Cancelas cuando quieras
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        Garantía 30 días
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
              ) : (
                <div className="max-w-2xl mx-auto mt-12 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="hero" size="xl" onClick={() => navigate("/dashboard")}>
                    Volver al dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="xl" onClick={reset}>
                    Hacer otro scan
                  </Button>
                </div>
              )}

              {/* Tarjeta compartible (oculta off-screen) */}
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: -9999,
                  pointerEvents: "none",
                }}
                aria-hidden
              >
                <div
                  ref={shareRef}
                  style={{
                    width: 1080,
                    height: 1350,
                    background:
                      "radial-gradient(circle at 20% 10%, rgba(250,204,21,0.18), transparent 55%), radial-gradient(circle at 85% 90%, rgba(250,204,21,0.08), transparent 50%), #0a0a0a",
                    color: "#fff",
                    fontFamily: "Inter, system-ui, sans-serif",
                    padding: 56,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 16,
                          background: "rgba(250,204,21,0.18)",
                          border: "1px solid rgba(250,204,21,0.5)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 28,
                        }}
                      >
                        ⚡
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Autopilot</div>
                        <div style={{ fontSize: 14, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 2 }}>
                          AI Physique Scan
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#facc15",
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        padding: "8px 14px",
                        border: "1px solid rgba(250,204,21,0.5)",
                        borderRadius: 999,
                      }}
                    >
                      Análisis IA
                    </div>
                  </div>

                  {currentImg && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
                      {objectiveImg ? (
                        <>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                            <img
                              src={currentImg}
                              style={{
                                width: 380,
                                height: 500,
                                borderRadius: 24,
                                objectFit: "cover",
                                border: "2px solid #facc15",
                                boxShadow: "0 0 60px rgba(250,204,21,0.25)",
                              }}
                            />
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#facc15", textTransform: "uppercase", letterSpacing: 3 }}>
                              Ahora
                            </div>
                          </div>
                          <div
                            style={{
                              width: 60,
                              height: 60,
                              borderRadius: 999,
                              background: "rgba(250,204,21,0.15)",
                              border: "1px solid rgba(250,204,21,0.5)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 28,
                              color: "#facc15",
                              flexShrink: 0,
                            }}
                          >
                            →
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                            <img
                              src={objectiveImg}
                              style={{
                                width: 380,
                                height: 500,
                                borderRadius: 24,
                                objectFit: "cover",
                                border: "2px solid #facc15",
                                boxShadow: "0 0 60px rgba(250,204,21,0.25)",
                              }}
                            />
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#facc15", textTransform: "uppercase", letterSpacing: 3 }}>
                              Objetivo
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                          <img
                            src={currentImg}
                            style={{
                              width: 460,
                              height: 580,
                              borderRadius: 28,
                              objectFit: "cover",
                              border: "2px solid #facc15",
                              boxShadow: "0 0 80px rgba(250,204,21,0.3)",
                            }}
                          />
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#facc15", textTransform: "uppercase", letterSpacing: 3 }}>
                            Mi físico
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 22, color: "#a1a1aa", marginBottom: 18, textTransform: "uppercase", letterSpacing: 3 }}>
                      Diagnóstico
                    </div>
                    <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }}>
                      "{(result.headline_diagnosis ?? result.summary ?? "").slice(0, 110)}{((result.headline_diagnosis ?? result.summary ?? "").length > 110) ? "…" : ""}"
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                    {result.percentile !== undefined && (
                      <StatBox label="Percentil" value={`Top ${100 - result.percentile}%`} sub="vs población" />
                    )}
                    {result.aesthetic_age !== undefined && (
                      <StatBox label="Edad estética" value={`${result.aesthetic_age}`} sub="años percibidos" />
                    )}
                    {result.months_with_plan !== undefined && (
                      <StatBox
                        label="A mi objetivo"
                        value={`${result.months_with_plan}m`}
                        sub={
                          result.months_without_plan !== undefined
                            ? `vs ${result.months_without_plan}m sin plan`
                            : "con plan"
                        }
                      />
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 28,
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ fontSize: 18, color: "#a1a1aa" }}>Haz tu scan gratis en</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: "#facc15" }}>
                      autopilotplan.com/scan
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const StatBox = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div
    style={{
      background: "rgba(250,204,21,0.05)",
      border: "1px solid rgba(250,204,21,0.2)",
      borderRadius: 24,
      padding: 28,
    }}
  >
    <div style={{ fontSize: 13, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
      {label}
    </div>
    <div
      style={{
        fontSize: 56,
        fontWeight: 700,
        letterSpacing: -1.5,
        background: "linear-gradient(135deg,#fde047,#facc15)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: 14, color: "#71717a", marginTop: 10 }}>{sub}</div>
  </div>
);

export default Scan;