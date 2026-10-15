import { errorMessage, errorStatus } from "@/lib/runtimeValues";
import React, { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import UserSidebar from "@/components/UserSidebar";
import MobileAppShell from "@/components/mobile/MobileAppShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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
  X,
  Lock,
  Users,
  Clock,
  AlertTriangle,
  Eye,
  Share2,
  Download,
  Phone,
  Mail,
  Shield,
  Dumbbell,
  Flame,
  RefreshCw,
  Activity,
  Sprout,
  Ruler,
  Dna,
  ClipboardList,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ProgressRing } from "@/components/ui/progress-ring";
import { hapticTap, hapticSelection } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import { applyScanPlan, canApplyScanToPlan, hasScanInferences } from "@/lib/scanApply";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import poseFrontImg from "@/assets/pose-front.png";
import poseBackImg from "@/assets/pose-back.png";
import ProjectionTimeline from "@/components/scan/ProjectionTimeline";
import LockedInsightsGrid from "@/components/scan/LockedInsightsGrid";
import StickyConversionBar from "@/components/scan/StickyConversionBar";
import ScanCoverageCard from "@/components/scan/ScanCoverageCard";
import ScanRecommendations, { recommendFor } from "@/components/scan/ScanRecommendations";
import { euro, usePlanAvailability } from "@/lib/planCatalog";
import SocialProofStrip from "@/components/scan/SocialProofStrip";
import ScanProgressPanel from "@/components/scan/ScanProgressPanel";
import BeforeAfterCompare from "@/components/scan/BeforeAfterCompare";
import { TRIAL_DAYS, GUARANTEE_DAYS } from "@/config/pricing";
import { signedUrlFor, signedUrlsFor } from "@/lib/storageSign";
import { toLocalDateString } from "@/lib/localDates";
import { clearAnonScanId, getOrCreateAnonScanId } from "@/lib/scanAttribution";

type Phase = "upload" | "goal" | "analyzing" | "lead";

const COUNTRIES: { code: string; dial: string; flag: string; name: string }[] = [
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "España" },
  { code: "MX", dial: "+52", flag: "🇲🇽", name: "México" },
  { code: "AR", dial: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "CO", dial: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "CL", dial: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "PE", dial: "+51", flag: "🇵🇪", name: "Perú" },
  { code: "UY", dial: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "EC", dial: "+593", flag: "🇪🇨", name: "Ecuador" },
  { code: "VE", dial: "+58", flag: "🇻🇪", name: "Venezuela" },
  { code: "BO", dial: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "PY", dial: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "DO", dial: "+1", flag: "🇩🇴", name: "Rep. Dominicana" },
  { code: "PR", dial: "+1", flag: "🇵🇷", name: "Puerto Rico" },
  { code: "CR", dial: "+506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "PA", dial: "+507", flag: "🇵🇦", name: "Panamá" },
  { code: "GT", dial: "+502", flag: "🇬🇹", name: "Guatemala" },
  { code: "HN", dial: "+504", flag: "🇭🇳", name: "Honduras" },
  { code: "SV", dial: "+503", flag: "🇸🇻", name: "El Salvador" },
  { code: "NI", dial: "+505", flag: "🇳🇮", name: "Nicaragua" },
  { code: "CU", dial: "+53", flag: "🇨🇺", name: "Cuba" },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "PT", dial: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "FR", dial: "+33", flag: "🇫🇷", name: "Francia" },
  { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italia" },
  { code: "DE", dial: "+49", flag: "🇩🇪", name: "Alemania" },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "Reino Unido" },
  { code: "IE", dial: "+353", flag: "🇮🇪", name: "Irlanda" },
  { code: "NL", dial: "+31", flag: "🇳🇱", name: "Países Bajos" },
  { code: "BE", dial: "+32", flag: "🇧🇪", name: "Bélgica" },
  { code: "CH", dial: "+41", flag: "🇨🇭", name: "Suiza" },
  { code: "AT", dial: "+43", flag: "🇦🇹", name: "Austria" },
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "MA", dial: "+212", flag: "🇲🇦", name: "Marruecos" },
  { code: "AD", dial: "+376", flag: "🇦🇩", name: "Andorra" },
];

const GOALS = [
  { id: "lose_fat", label: "Perder grasa", icon: Flame, desc: "Definirme y bajar % graso" },
  { id: "gain_muscle", label: "Ganar músculo", icon: Dumbbell, desc: "Más volumen y fuerza" },
  { id: "recomp", label: "Recomposición", icon: RefreshCw, desc: "Bajar grasa y ganar músculo a la vez" },
  { id: "posture", label: "Mejorar postura", icon: Activity, desc: "Espalda, hombros y core" },
  { id: "from_zero", label: "Empezar desde cero", icon: Sprout, desc: "Llevo tiempo parado o nunca entrené" },
] as const;

const LOADING_MESSAGES = [
  "Analizando postura…",
  "Detectando prioridades físicas…",
  "Calculando margen de mejora…",
  "Evaluando proporciones y simetría…",
  "Evaluando tu punto de partida…",
  "Generando tu diagnóstico personalizado…",
];

type Result = {
  attractiveness: number;
  potential: number;
  physique: number;
  style: number;
  similarity: number;
  estimated_months?: number;
  improvements: { label: string; priority: "Alta" | "Media" | "Baja" }[];
  summary: string;
  confidence?: number;
  views_detected?: string[];
  photo_quality_notes?: string[];
  months_without_plan?: number;
  months_with_plan?: number;
  headline_diagnosis?: string;
  bottleneck?: string;
  inferred_goal?: string;
  inferred_focus?: string;
  inferred_intensity?: number;
  inferred_specific_goals?: string[];
  locked_insights?: { label: string; teaser: string; category?: string }[];
  body_composition?: {
    body_fat_pct?: number;
    lean_mass_kg?: number;
    weight_kg?: number;
    somatotype?: string;
    frame_size?: string;
    fat_distribution?: string;
  };
  muscle_breakdown?: { group: string; score: number; verdict: string }[];
  posture?: { issues?: string[]; severity?: string; note?: string };
  proportions?: {
    shoulder_to_waist_ratio?: number;
    v_taper_score?: number;
    symmetry_score?: number;
    upper_lower_balance?: string;
    weakest_link?: string;
  };
  genetic_markers?: string[];
  protocol?: {
    training_days_per_week?: number;
    weekly_sets_priority?: number;
    weekly_sets_maintenance?: number;
    calorie_adjustment_kcal?: number;
    protein_g_per_kg?: number;
    cardio_minutes_per_week?: number;
    key_lifts?: string[];
    avoid?: string[];
  };
};

type GoalPhysique = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  user_id?: string | null;
  /** Ruta original en el bucket cuando `image_url` ya es una URL firmada para mostrar. */
  storage_path?: string;
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
  placeholder,
}: {
  label: string;
  hint: string;
  image: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
  placeholder?: string;
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
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-card">
          <img loading="lazy" decoding="async" src={image} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={() => { void hapticTap(); onClear(); }}
            aria-label="Quitar foto"
            className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center active:opacity-60"
          >
            <span className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center">
              <X className="w-4 h-4" />
            </span>
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-background/80 p-3">
            <div className="type-headline text-primary">
              {label}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { void hapticTap(); inputRef.current?.click(); }}
          className="relative aspect-[3/4] w-full rounded-2xl bg-card transition-colors active:bg-accent flex flex-col items-center justify-center gap-3 p-3 sm:p-6 overflow-hidden"
        >
          {placeholder && (
            <img
              src={placeholder}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 w-full h-full object-contain opacity-15 pointer-events-none select-none"
            />
          )}
          <div className="relative w-14 h-14 rounded-[22%] bg-secondary flex items-center justify-center">
            <Upload className="w-7 h-7 text-primary" strokeWidth={1.75} />
          </div>
          <div className="relative text-center">
            <div className="type-headline">{label}</div>
            <div className="type-subhead text-muted-foreground mt-0.5">{hint}</div>
          </div>
        </button>
      )}
    </div>
  );
};

const ScoreCard = ({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) => (
  <div
    className={`relative bg-card rounded-2xl p-4 ${highlight ? "ring-1 ring-primary/40" : ""}`}
  >
    <div className="type-group-header text-muted-foreground mb-1 flex items-center gap-1">
      {highlight && <Zap className="w-3 h-3 text-primary" />}
      {label}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="type-title1 font-rounded tabular-nums text-primary">
        {value.toFixed(1)}
      </span>
      <span className="type-caption1 text-muted-foreground">/10</span>
    </div>
    <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-2">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value * 10}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full bg-primary"
      />
    </div>
  </div>
);

const Scan = ({ inline = false }: { inline?: boolean } = {}) => {
  const plans = usePlanAvailability();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const routeUserId = inline ? user?.id : paramUserId;
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      // Si intenta acceder al espacio personal sin sesión, mándalo a login.
      if (routeUserId) {
        navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
      }
      return;
    }
    if (routeUserId && routeUserId !== user.id) {
      // Autorización: solo puedes ver tu propio progreso.
      navigate(`/scan/user/${user.id}`, { replace: true });
    }
  }, [user, routeUserId, location.pathname, navigate]);

  // Bloquea el render mientras se resuelve la autorización para evitar fugas de datos ajenos.
  const isUnauthorized = routeUserId && user && routeUserId !== user.id;
  const isAwaitingAuth = routeUserId && !user;
  const [isPaid, setIsPaid] = useState(false);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [backImg, setBackImg] = useState<string | null>(null);
  const [objectiveImg, setObjectiveImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [futureImgs, setFutureImgs] = useState<{ front?: string; back?: string }>({});
  const [simPoseChoice, setSimPose] = useState<"front" | "back">("front");
  // Simulamos solo las vistas subidas: si solo hay espalda, espalda; si solo frente, frente.
  const simPose: "front" | "back" = currentImg && backImg ? simPoseChoice : backImg && !currentImg ? "back" : "front";
  const simBase = simPose === "back" ? backImg : currentImg;
  const futureImg = futureImgs[simPose] ?? null;
  const [genLoading, setGenLoading] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [planApplyState, setPlanApplyState] = useState<"idle" | "applying" | "success" | "sent" | "error">("idle");
  const [canApplyPlan, setCanApplyPlan] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [goalPresets, setGoalPresets] = useState<GoalPhysique[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [savedObjectiveUrl, setSavedObjectiveUrl] = useState<string | null>(null);
  const [savedObjectivePath, setSavedObjectivePath] = useState<string | null>(null);
  const [editingObjective, setEditingObjective] = useState(false);
  const [hasObjectiveChoice, setHasObjectiveChoice] = useState<"unset" | "yes" | "no">("unset");
  const [savedGoalText, setSavedGoalText] = useState<string | null>(null);

  // Funnel state
  const [phase, setPhase] = useState<Phase>("upload");
  const [goal, setGoal] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<Result | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [leadName, setLeadName] = useState("");
  const [leadCountry, setLeadCountry] = useState("ES");
  const [leadWhatsapp, setLeadWhatsapp] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadConsent, setLeadConsent] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("payment_status, subscription_tier, subscription_status, subscription_end, stripe_payment_id, email, name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setIsPaid(data?.payment_status === "paid");
        setUserEmail(data?.email ?? user.email ?? null);
        setUserName(data?.name ?? null);
        setLeadEmail((prev) => prev || data?.email || user.email || "");
        setLeadName((prev) => prev || data?.name || "");
        const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        setCanApplyPlan(canApplyScanToPlan(data, !!isAdmin));
      });
    supabase
      .from("onboarding")
      .select("goal_photo_url, goal, specific_goal")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const url = data?.goal_photo_url ?? null;
        if (url) {
          setSavedObjectivePath(url);
          // Bucket es privado: firmar la URL para visualización y para enviar al análisis IA.
          import("@/lib/storageSign").then(({ signedUrlFor }) =>
            signedUrlFor("progress-photos", url).then((signed) => {
              const finalUrl = signed || url;
              setSavedObjectiveUrl(finalUrl);
              setObjectiveImg((prev) => prev ?? finalUrl);
            })
          );
        }
        const txt = (data?.specific_goal || data?.goal || "").toString().trim();
        if (txt) setSavedGoalText(txt);
      });
  }, [user]);

  // Cargar físicos objetivo: los públicos del admin + los del propio usuario
  const loadGoalPresets = async () => {
    const { data } = await supabase
      .from("goal_physiques")
      .select("id, name, description, image_url, user_id")
      .order("sort_order", { ascending: true });
    const rows = ((data as GoalPhysique[]) ?? []);
    // Las imágenes propias viven en progress-photos (privado): firmamos para poder mostrarlas.
    const own = rows.map((r) => r.image_url).filter((u): u is string => !!u && !/^https?:/i.test(u));
    const map = own.length ? await signedUrlsFor("progress-photos", own) : new Map<string, string>();
    setGoalPresets(rows.map((r) => {
      if (!r.image_url || /^https?:/i.test(r.image_url)) return r;
      const signed = map.get(r.image_url);
      return signed ? { ...r, storage_path: r.image_url, image_url: signed } : r;
    }));
  };
  useEffect(() => {
    loadGoalPresets();
  }, [user?.id]);

  const handleShare = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await renderScanCardDataUrl();
      if (!dataUrl) throw new Error("no card");
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "autopilot-scan.png", { type: "image/png" });

      const navAny = navigator;
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
    } catch (e: unknown) {
      console.error(e);
      toast.error("No se pudo generar la tarjeta");
    } finally {
      setSharing(false);
    }
  };

  // Render the share card (offscreen) to a PNG data URL. Returns null if not mounted.
  const renderScanCardDataUrl = async (): Promise<string | null> => {
    // Esperar a que React monte la tarjeta offscreen (puede tardar varios ticks tras setResult)
    for (let i = 0; i < 30; i++) {
      if (shareRef.current) break;
      await new Promise<void>((r) => setTimeout(r, 100));
    }
    if (!shareRef.current) return null;
    // Extra tick para que fuentes/layout se asienten
    await new Promise<void>((r) => setTimeout(r, 150));
    // Asegurar que TODAS las <img loading="lazy" decoding="async"> internas (foto del usuario, etc.) están decodificadas
    // antes de capturar — si no, html-to-image las pinta vacías.
    try {
      const imgs = Array.from(shareRef.current.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );
      // Algunos navegadores necesitan un decode explícito
      await Promise.all(
        imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
      );
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }
    try {
      // Llamamos dos veces: la primera "calienta" caches de fuentes/imágenes y la
      // segunda devuelve la imagen final ya con todo embebido correctamente.
      // Es un workaround conocido de html-to-image cuando hay <img loading="lazy" decoding="async"> con data URLs.
      await toPng(shareRef.current, { cacheBust: true, pixelRatio: 1.5, backgroundColor: "#0a0a0a" });
      // Bajamos la resolución si el PNG supera el límite de subida (~4MB).
      for (const ratio of [1.5, 1, 0.75]) {
        const url = await toPng(shareRef.current, {
          cacheBust: true,
          pixelRatio: ratio,
          backgroundColor: "#0a0a0a",
        });
        const approxBytes = (url.length - (url.indexOf(",") + 1)) * 0.75;
        if (approxBytes < 3.5 * 1024 * 1024 || ratio === 0.75) return url;
      }
      return null;
    } catch (e) {
      console.warn("renderScanCardDataUrl failed", e);
      return null;
    }
  };

  // Sube la tarjeta PNG vía edge function y devuelve una URL firmada temporal.
  // La tarjeta incluye la foto del usuario, así que el objeto vive en un bucket
  // privado y el enlace del email caduca a los 7 días.
  const uploadScanCard = async (): Promise<string | null> => {
    try {
      const dataUrl = await renderScanCardDataUrl();
      if (!dataUrl) return null;
      const pngBase64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      // Sin sesión no hay user_id: enviamos el id anónimo de la pestaña para que
      // la tarjeta quede atribuida y se pueda borrar al eliminar la cuenta (RGPD).
      const { data, error } = await supabase.functions.invoke("upload-scan-card", {
        body: {
          pngBase64,
          ...(user ? {} : { anonSessionId: getOrCreateAnonScanId() }),
        },
      });
      if (error) {
        console.warn("upload-scan-card error", error);
        return null;
      }
      const payload = data as { signedUrl?: string; publicUrl?: string } | null;
      return payload?.signedUrl ?? payload?.publicUrl ?? null;
    } catch (e) {
      console.warn("uploadScanCard failed", e);
      return null;
    }
  };

  const generateFuture = async (pose: "front" | "back" = simPose) => {
    const baseImg = pose === "back" ? backImg : currentImg;
    if (!baseImg || !result) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-future-self", {
        body: {
          currentImage: baseImg,
          months: result.months_with_plan ?? result.estimated_months ?? 6,
          goal: result.inferred_goal,
          pose,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFutureImgs((m) => ({ ...m, [pose]: data.imageUrl }));
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "Error generando la simulación");
    } finally {
      setGenLoading(false);
    }
  };

  useEffect(() => {
    const prevTitle = document.title;
    const title = "AI Scan Autopilot Plan – Analiza tu físico con IA gratis";
    const description =
      "AI Scan de Autopilot Plan: sube una foto y la IA analiza tu físico, potencial y mejoras en menos de un minuto (aprox.). Gratis y sin registro.";
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
    if (!currentImg && !backImg) {
      toast.error("Sube al menos una foto: de delante, de atrás o las dos");
      return;
    }
    setLoading(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress((p) => Math.min(p + Math.random() * 8, 95));
    }, 300);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-physique", {
        body: { currentImage: currentImg, backImage: backImg, objectiveImage: objectiveImg },
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
      } catch { /* Best-effort browser feature; the primary flow remains available. */ }
      setPendingResult(r);
      // Si está logueado saltamos el formulario de lead (ya tenemos su email)
      if (user && isPaid && routeUserId) {
        setTimeout(() => {
          setResult(r);
          // El plan NUNCA se toca solo: lo aplica el usuario con «Aplicar a mi plan».
          saveAndEmailScan(r, { silent: false });
        }, 400);
      } else if (user && isPaid) {
        // Logueado y pagado en /scan general: muestra resultado sin tocar el plan
        setTimeout(() => {
          setResult(r);
          saveAndEmailScan(r, { silent: true });
        }, 400);
      } else if (user) {
        // Logueado no pagado: muestra resultado y envía email a la cuenta
        setTimeout(() => {
          setResult(r);
          saveAndEmailScan(r, { silent: true });
        }, 400);
      }
      // En caso contrario, el efecto del paso "analyzing" hará la transición a "lead"
    } catch (e: unknown) {
      console.error(e);
      const status = errorStatus(e);
      const msg = errorMessage(e);
      if (status === 429 || /too many|429/i.test(msg)) {
        toast.error("Has hecho muchos análisis seguidos. Espera un rato y vuelve a intentarlo.");
      } else {
        toast.error("No hemos podido analizar las fotos. Inténtalo de nuevo en unos segundos.");
      }
      setPhase("upload");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  // Rotate loading messages while analyzing
  useEffect(() => {
    if (phase !== "analyzing") return;
    setLoadingMsgIdx(0);
    const id = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1600);
    return () => clearInterval(id);
  }, [phase]);

  // Kick off analysis when entering "analyzing" phase
  useEffect(() => {
    if (phase === "analyzing" && !loading && !pendingResult && (currentImg || backImg)) {
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Transition analyzing -> lead once analysis is ready (min 3s for UX)
  useEffect(() => {
    if (phase !== "analyzing" || !pendingResult) return;
    if (user) return; // logueados van directos al resultado, sin formulario de lead
    const t = setTimeout(() => setPhase("lead"), 1200);
    return () => clearTimeout(t);
  }, [phase, pendingResult, user]);

  const submitLead = async () => {
    if (!leadName.trim() || leadName.trim().length < 2) {
      toast.error("Introduce tu nombre");
      return;
    }
    if (!leadEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim())) {
      toast.error("Introduce un email válido");
      return;
    }
    if (!leadConsent) {
      toast.error("Necesitamos tu consentimiento para continuar");
      return;
    }
    setSubmittingLead(true);
    try {
      const { error } = await supabase.from("scan_leads").insert({
        user_id: user?.id ?? null,
        name: leadName.trim().slice(0, 100),
        whatsapp: null,
        email: leadEmail.trim().slice(0, 255),
        goal: goal ?? "unspecified",
        consent: leadConsent,
        result: pendingResult,
      });
      if (error) throw error;
      // Guardamos nombre y email para no pedirlos otra vez al crear la cuenta
      try {
        const raw = sessionStorage.getItem("autopilot_scan");
        const prev = raw ? JSON.parse(raw) : { createdAt: Date.now() };
        sessionStorage.setItem(
          "autopilot_scan",
          JSON.stringify({ ...prev, leadName: leadName.trim(), leadEmail: leadEmail.trim() })
        );
      } catch { /* Best-effort browser feature; the primary flow remains available. */ }
      if (pendingResult) setResult(pendingResult);
      // Enviar diagnóstico por email (la API de WhatsApp no está disponible)
      try {
        const r = pendingResult;
        if (r) {
          const recipient = leadEmail.trim();
          const cardImageUrl = await uploadScanCard();
          const { error: emailError } = await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "scan-diagnosis",
              recipientEmail: recipient,
              idempotencyKey: `scan-diagnosis-${recipient}-${Date.now()}`,
              templateData: {
                name: leadName.trim().split(" ")[0],
                attractiveness: r.attractiveness,
                physique: r.physique,
                potential: r.potential,
                style: r.style,
                similarity: r.similarity,
                monthsWithPlan: r.months_with_plan ?? r.estimated_months,
                monthsWithoutPlan: r.months_without_plan,
                headline: r.headline_diagnosis ?? undefined,
                bottleneck: r.bottleneck ?? undefined,
                summary: r.summary ?? undefined,
                priorities: (r.improvements ?? []).slice(0, 5),
                reportUrl: "https://autopilotplan.com/scan",
                cardImageUrl: cardImageUrl ?? undefined,
                SCAN_IMAGE_URL: cardImageUrl ?? undefined,
              },
            },
          });
          // Solo confirmamos el envío si la función no devolvió error.
          if (emailError) throw emailError;
          toast.success("Te hemos enviado el diagnóstico por email");
        }
      } catch (err) {
        console.warn("send diagnosis email failed", err);
        toast.error("Diagnóstico listo, pero no pudimos enviarlo por email");
      }
    } catch (e: unknown) {
      console.error("submitLead", e);
      toast.error("No se pudo enviar. Inténtalo de nuevo.");
    } finally {
      setSubmittingLead(false);
    }
  };

  const applyScanToPlan = async (r: Result) => {
    if (!user || planApplyState === "applying") return;
    setPlanApplyState("applying");
    const outcome = await applyScanPlan(supabase, user.id, r).catch((e: unknown) => {
      console.error("applyScanToPlan", e);
      return "failed" as const;
    });
    switch (outcome) {
      case "applied":
        setPlanApplyState("success");
        toast.success("Plan actualizado con tu scan");
        break;
      case "sent_to_coach":
        setPlanApplyState("sent");
        toast.success("Scan enviado a tu entrenador para ajustar el plan");
        break;
      case "no_changes":
        setPlanApplyState("idle");
        toast.info("Este scan no propone cambios en tu plan");
        break;
      case "needs_profile":
        setPlanApplyState("idle");
        toast.error("Te falta completar tu perfil para poder aplicar el scan. Complétalo en Ajustes.");
        break;
      case "kept":
        setPlanApplyState("idle");
        setCanApplyPlan(false);
        toast.info("Tu plan gratuito mantiene su rutina. Tu plan no ha cambiado.");
        break;
      default:
        setPlanApplyState("error");
        toast.error("No se pudo aplicar al plan. Tu plan no ha cambiado.");
    }
  };

  // Sube una foto (dataURL) a la carpeta del usuario en progress-photos y devuelve
  // la RUTA almacenada y una URL firmada para mostrarla. El bucket es privado: una
  // URL pública no carga nunca.
  const uploadDataUrl = async (dataUrl: string, suffix: string): Promise<{ path: string; url: string } | null> => {
    if (!user) return null;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${user.id}/scan_${Date.now()}_${suffix}.${ext}`;
      const { error } = await supabase.storage.from("progress-photos").upload(path, blob, { upsert: false, contentType: blob.type });
      if (error) return null;
      const url = await signedUrlFor("progress-photos", path, 60 * 60 * 24 * 7);
      if (!url) return null;
      return { path, url };
    } catch { return null; }
  };

  // Sube una foto subida por el usuario y la registra como objetivo personalizado
  const [savingCustomGoal, setSavingCustomGoal] = useState(false);
  const saveCustomGoalPreset = async (dataUrl: string) => {
    if (!user) {
      toast.error("Inicia sesión para guardar tus objetivos");
      return;
    }
    const rawName = window.prompt(
      "¿Cómo quieres llamar a este objetivo? (lo guardaremos en tus objetivos personalizados)",
      ""
    );
    if (rawName === null) return; // cancelled
    const name = rawName.trim().slice(0, 60);
    if (!name) {
      toast.error("Pon un nombre para guardarlo");
      return;
    }
    setSavingCustomGoal(true);
    try {
      const uploaded = await uploadDataUrl(dataUrl, "goal");
      if (!uploaded) throw new Error("upload failed");
      const { data, error } = await supabase
        .from("goal_physiques")
        .insert({
          user_id: user.id,
          name,
          description: "",
          image_url: uploaded.path,
          visible: false,
          sort_order: 999,
        })
        .select("id, name, description, image_url, user_id")
        .single();
      if (error) throw error;
      // Guardamos la ruta en la base de datos y mostramos la URL firmada.
      const preset = { ...(data as GoalPhysique), storage_path: uploaded.path, image_url: uploaded.url };
      setGoalPresets((prev) => [...prev, preset]);
      setObjectiveImg(preset.image_url);
      setSelectedPresetId(preset.id);
      toast.success(`"${preset.name}" guardado en tus objetivos`);
    } catch (e) {
      console.warn("save custom goal failed", e);
      toast.error("No se pudo guardar tu objetivo");
    } finally {
      setSavingCustomGoal(false);
    }
  };

  // For logged-in users: save scan to history + auto-email diagnosis to account email
  const saveAndEmailScan = async (r: Result, opts: { silent?: boolean } = {}) => {
    if (!user || !userEmail) return;
    setAutoSaving(true);
    try {
      const [front, back, obj] = await Promise.all([
        currentImg ? uploadDataUrl(currentImg, "front") : Promise.resolve(null),
        backImg ? uploadDataUrl(backImg, "back") : Promise.resolve(null),
        objectiveImg ? uploadDataUrl(objectiveImg, "objective") : Promise.resolve(null),
      ]);

      const { error: insErr } = await supabase.from("scan_history").insert({
        user_id: user.id,
        current_photo_url: front?.path ?? null,
        back_photo_url: back?.path ?? null,
        objective_photo_url: obj?.path ?? null,
        result: r,
        attractiveness: r.attractiveness,
        potential: r.potential,
        physique: r.physique,
        style: r.style,
        similarity: r.similarity,
        months_with_plan: r.months_with_plan ?? r.estimated_months ?? null,
        months_without_plan: r.months_without_plan ?? null,
        emailed_to: userEmail,
      });
      if (insErr) console.warn("scan_history insert", insErr);

      // La foto frontal del scan también queda en «Físico» (diario de progreso).
      for (const [ph, label] of [[front, "Scan · frente"], [back, "Scan · espalda"]] as const) {
        if (!ph) continue;
        const { error: phErr } = await supabase.from("progress_photos").insert({
          user_id: user.id,
          photo_url: ph.path,
          note: label,
          taken_at: toLocalDateString(),
        });
        if (phErr) console.warn("progress_photos insert", phErr);
      }

      const firstName = (userName || user.email?.split("@")[0] || "atleta").split(" ")[0];
      const cardImageUrl = await uploadScanCard();
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "scan-diagnosis",
          recipientEmail: userEmail,
          idempotencyKey: `scan-diagnosis-${user.id}-${Date.now()}`,
          templateData: {
            name: firstName,
            attractiveness: r.attractiveness,
            physique: r.physique,
            potential: r.potential,
            style: r.style,
            similarity: r.similarity,
            monthsWithPlan: r.months_with_plan ?? r.estimated_months,
            monthsWithoutPlan: r.months_without_plan,
            headline: r.headline_diagnosis ?? undefined,
            bottleneck: r.bottleneck ?? undefined,
            summary: r.summary ?? undefined,
            priorities: (r.improvements ?? []).slice(0, 5),
            lockedInsights: (r.locked_insights ?? []).slice(0, 3),
            photoUrl: front?.url ?? undefined,
            reportUrl: "https://autopilotplan.com/dashboard",
            cardImageUrl: cardImageUrl ?? undefined,
            SCAN_IMAGE_URL: cardImageUrl ?? undefined,
          },
        },
      });
      setAutoSaved(true);
      if (!opts.silent) toast.success(`Diagnóstico enviado a ${userEmail}`);
    } catch (e) {
      console.warn("saveAndEmailScan failed", e);
      if (!opts.silent) toast.error("No se pudo enviar el email");
    } finally {
      setAutoSaving(false);
    }
  };

  const resendByEmail = async () => {
    if (!result) return;
    setEmailSending(true);
    await saveAndEmailScan(result);
    setEmailSending(false);
  };

  const reset = () => {
    // Un escaneo nuevo estrena id anónimo: el anterior ya no debe atribuirse a
    // quien escanee después en esta misma pestaña.
    clearAnonScanId();
    setResult(null);
    setCurrentImg(null);
    setBackImg(null);
    setObjectiveImg(null);
    setScanProgress(0);
    setPhase("upload");
    setGoal(null);
    setPendingResult(null);
    setLeadName("");
    setLeadWhatsapp("");
    setLeadEmail("");
    setLeadConsent(false);
  };

  const [resettingProgress, setResettingProgress] = useState(false);
  const resetProgress = async () => {
    if (!user || !routeUserId) return;
    const ok = window.confirm(
      "¿Seguro que quieres resetear tu progreso? Se borrarán todos tus scans anteriores y empezarás de cero. Esta acción no se puede deshacer."
    );
    if (!ok) return;
    setResettingProgress(true);
    try {
      // Antes de borrar el historial, borramos también las fotos del bucket privado:
      // si no, el usuario cree que las ha eliminado y siguen guardadas.
      type ScanHistoryPhotoRow = {
        current_photo_url: string | null;
        back_photo_url: string | null;
        objective_photo_url: string | null;
      };
      const scanHistoryClient = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => Promise<{ data: ScanHistoryPhotoRow[] | null }>;
          };
        };
      };
      const { data: rows } = await scanHistoryClient
        .from("scan_history")
        .select("current_photo_url, back_photo_url, objective_photo_url")
        .eq("user_id", user.id);
      const toPath = (v: unknown): string | null => {
        if (typeof v !== "string" || !v) return null;
        const marker = "/progress-photos/";
        const idx = v.indexOf(marker);
        if (idx >= 0) return v.substring(idx + marker.length).split("?")[0] || null;
        return /^https?:/i.test(v) ? null : v;
      };
      const paths = (rows ?? [])
        .flatMap((r) => [r.current_photo_url, r.back_photo_url, r.objective_photo_url])
        .map(toPath)
        .filter((p): p is string => !!p);
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage.from("progress-photos").remove(paths);
        if (removeError) console.warn("No se pudieron borrar todas las fotos del scan", removeError);
      }
      const { error } = await supabase
        .from("scan_history")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      setAutoSaved(false);
      reset();
      toast.success("Progreso reseteado. Sube una nueva foto para empezar.");
    } catch (e) {
      console.warn("reset progress failed", e);
      toast.error("No se pudo resetear el progreso");
    } finally {
      setResettingProgress(false);
    }
  };

  // Destino del CTA: si el scan ya recomendó un plan, lo llevamos hasta el registro
  // para no obligar al usuario a elegir otra vez.
  const signupWithPlan = (() => {
    if (user) return "/dashboard";
    if (result) {
      const { rec } = recommendFor({
        bottleneck: result.bottleneck,
        improvements: result.improvements,
        monthsWithPlan: result.months_with_plan,
        plans,
      });
      if (rec.kind === "plan") return `${rec.to}&from=scan`;
    }
    return "/signup?from=scan";
  })();

  if (isUnauthorized || isAwaitingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground type-subhead">
        {isUnauthorized ? "Solo puedes ver tu propio progreso. Redirigiendo…" : "Verificando acceso…"}
      </div>
    );
  }

  const embedded = inline || (!!user && isMobile);
  const scanBody = (
    <>
      <Helmet>
        <title>{routeUserId ? "Mi progreso · AI Scan" : "Análisis corporal gratis con IA · Autopilot"}</title>
        <meta name="description" content="Sube una foto y recibe un análisis estimado por IA de tu físico, con lo que más te limita y por dónde empezar. Gratis y sin tarjeta." />
        {routeUserId ? (
          <meta name="robots" content="noindex,nofollow" />
        ) : (
          <link rel="canonical" href="https://autopilotplan.com/scan" />
        )}
        <meta property="og:title" content="AI Body Scan · Autopilot" />
        <meta property="og:description" content="Análisis IA gratuito de tu físico con recomendaciones personalizadas." />
        <meta property="og:url" content="https://autopilotplan.com/scan" />
      </Helmet>
      {result && !isPaid && (
        // Sólo embudo para visitantes anónimos: usuarios logueados ven modo cuenta.
        !user &&
        <StickyConversionBar onCta={() => navigate(signupWithPlan)} />
      )}
      {/* Header */}
      {!embedded && <header className="container mx-auto max-w-7xl px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex items-center gap-1">
          {user && <SidebarTrigger className="hidden md:inline-flex" />}
          <Link
            to={user ? "/dashboard" : "/"}
            aria-label="Volver"
            onClick={() => void hapticTap()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-primary transition active:opacity-60"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
        <span className="type-headline">Escáner corporal</span>
        <div />
      </header>}

      <main className={embedded ? "w-full pb-6" : "container mx-auto max-w-7xl px-4 pb-24"}>
        <AnimatePresence mode="wait">
          {!result && phase === "upload" ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
            >
              {user && routeUserId && !inline && <ScanProgressPanel userId={user.id} />}
              <div className="text-center max-w-md mx-auto mt-2 mb-8">
                <h1 className="type-title1">Análisis físico con IA</h1>
                <p className="type-subhead text-muted-foreground mt-2">
                  Sube tu foto frontal o de espalda para actualizar tu análisis
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-5 max-w-md sm:max-w-3xl mx-auto mb-10">
                <Dropzone
                  label="Foto de delante"
                  hint="Cuerpo completo"
                  image={currentImg}
                  onFile={async (f) => setCurrentImg(await fileToDataUrl(f))}
                  onClear={() => setCurrentImg(null)}
                  placeholder={poseFrontImg}
                />
                <Dropzone
                  label="Foto de atrás"
                  hint="Cuerpo completo · opcional"
                  image={backImg}
                  onFile={async (f) => setBackImg(await fileToDataUrl(f))}
                  onClear={() => setBackImg(null)}
                  placeholder={poseBackImg}
                />
              </div>

              {/* Físico objetivo: presets del admin + opción de subir foto propia */}
              {user && savedObjectiveUrl && !editingObjective ? (
                <div className="mx-auto mb-10 max-w-md flex items-center gap-4">
                  <img loading="lazy" decoding="async"
                    src={savedObjectiveUrl}
                    alt="Tu objetivo"
                    className="w-20 h-24 object-cover rounded-[10px] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="type-headline truncate">
                      {goalPresets.find((p) => p.storage_path === savedObjectivePath || p.image_url === savedObjectiveUrl)?.name || savedGoalText || "Tu objetivo actual"}
                    </h2>
                    <p className="type-subhead text-muted-foreground mt-0.5">
                      La IA lo usará para estimar cuántos meses te faltan.
                    </p>
                    <div className="flex items-center gap-1 mt-1 -ml-3">
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() => { void hapticTap(); setEditingObjective(true); }}
                      >
                        Cambiar objetivo
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          void hapticTap();
                          setObjectiveImg(null);
                          setSelectedPresetId(null);
                          setEditingObjective(true);
                        }}
                        className="min-h-[34px] px-3 type-footnote text-muted-foreground active:opacity-60"
                      >
                        Quitar para este scan
                      </button>
                    </div>
                  </div>
                </div>
              ) : user && routeUserId && !savedObjectiveUrl && !editingObjective ? (
                <div className="mx-auto mb-10 max-w-md flex items-start gap-4">
                  <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
                    <Target className="w-7 h-7 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="type-headline">Tu objetivo</h2>
                    <p className="type-subhead text-muted-foreground mt-0.5 truncate">
                      {savedGoalText || "Sin objetivo definido"}
                    </p>
                    <Button variant="plain" size="sm" className="-ml-3 mt-1" onClick={() => { void hapticTap(); setEditingObjective(true); }}>
                      Cambiar objetivo
                    </Button>
                  </div>
                </div>
              ) : user && !savedObjectiveUrl && !editingObjective && hasObjectiveChoice === "unset" ? (
                <div className="mx-auto mb-10 max-w-md flex items-start gap-4">
                  <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
                    <Target className="w-7 h-7 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="type-headline">¿Tienes un físico objetivo?</h2>
                    <p className="type-subhead text-muted-foreground mt-0.5">
                      Solo si pones un objetivo te calculamos cuántos meses tardarás en llegar.
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1 -ml-3">
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() => { void hapticTap(); setHasObjectiveChoice("yes"); setEditingObjective(true); }}
                      >
                        Sí, elegir uno
                      </Button>
                      <Button
                        variant="plain"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => { void hapticTap(); setHasObjectiveChoice("no"); }}
                      >
                        No, sin objetivo
                      </Button>
                    </div>
                  </div>
                </div>
              ) : user && !savedObjectiveUrl && !editingObjective && hasObjectiveChoice === "no" ? (
                <div className="mx-auto mb-10 max-w-md flex items-center justify-between gap-3">
                  <p className="type-subhead text-muted-foreground">
                    Sin objetivo · el análisis se centra en tu físico actual.
                  </p>
                  <Button variant="plain" size="sm" className="shrink-0" onClick={() => { void hapticTap(); setHasObjectiveChoice("yes"); setEditingObjective(true); }}>
                    Añadir objetivo
                  </Button>
                </div>
              ) : (
              <div className="mx-auto mb-10 max-w-3xl">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
                    <Target className="w-7 h-7 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="type-headline">Tu físico objetivo</h2>
                    <p className="type-subhead text-muted-foreground mt-0.5">
                      Elige una referencia o sube tu foto. Solo con objetivo calculamos cuántos meses te faltan.
                    </p>
                    {objectiveImg && (
                      <Button
                        variant="plain"
                        size="sm"
                        className="-ml-3 mt-1"
                        onClick={() => { void hapticTap(); setObjectiveImg(null); setSelectedPresetId(null); }}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Un objetivo sin foto es una caja vacía con un nombre: no aporta nada */}
                {goalPresets.some((p) => p.image_url) && (
                  <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {goalPresets.filter((p) => p.image_url).map((p) => {
                      const isSel = selectedPresetId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={isSel}
                          onClick={() => {
                            void hapticSelection();
                            setObjectiveImg(p.image_url);
                            setSelectedPresetId(p.id);
                          }}
                          className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-card transition-transform duration-100 active:scale-[0.97] ${
                            isSel ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                          }`}
                        >
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-background/80 p-2">
                            <div className="line-clamp-2 type-caption1 font-semibold">
                              {p.name}
                            </div>
                          </div>
                          {isSel && (
                            <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5 text-background" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="grid sm:grid-cols-[180px,1fr] gap-4 items-center">
                  <div>
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          void hapticTap();
                          const dataUrl = await fileToDataUrl(f);
                          setObjectiveImg(dataUrl);
                          setSelectedPresetId(null);
                          if (user && routeUserId) await saveCustomGoalPreset(dataUrl);
                        }}
                      />
                      {objectiveImg && !selectedPresetId ? (
                        <img loading="lazy" decoding="async" src={objectiveImg} alt="tu objetivo" className="w-full aspect-[3/4] object-cover rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background" />
                      ) : (
                        <div className="rounded-2xl bg-card min-h-[88px] px-4 py-5 flex flex-col items-center justify-center text-center transition-colors active:bg-accent">
                          <Upload className="w-6 h-6 text-primary mb-2" strokeWidth={1.75} />
                          <div className="type-subhead font-semibold">O sube tu propia foto</div>
                          <div className="type-footnote text-muted-foreground mt-0.5">JPG / PNG</div>
                        </div>
                      )}
                    </label>
                  </div>
                  <div className="type-subhead text-muted-foreground">
                    {objectiveImg ? (
                      <span>
                        Objetivo seleccionado. La IA comparará tu físico con esta referencia y estimará cuántos meses te faltan.
                      </span>
                    ) : (
                      <span>
                        Sin objetivo el análisis se centra en tu físico actual, fortalezas y mejoras prioritarias — sin estimación de tiempo.
                      </span>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Guía para tomar las fotos */}
              <div className="mx-auto mb-10 max-w-md">
                <h2 className="type-title3 mb-5">Cómo tomar las fotos</h2>
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
                      <Ruler className="w-7 h-7 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="type-headline">Distancia</h3>
                      <p className="type-subhead text-muted-foreground mt-0.5">
                        Cámara a 2-3 m, a la altura del ombligo, con el cuerpo entero y el móvil en vertical y bien apoyado.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
                      <Eye className="w-7 h-7 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="type-headline">Luz y fondo</h3>
                      <p className="type-subhead text-muted-foreground mt-0.5">
                        Luz natural frontal y uniforme, sin contraluz ni flash, con un fondo liso y claro.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
                      <Activity className="w-7 h-7 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="type-headline">Postura y ropa</h3>
                      <p className="type-subhead text-muted-foreground mt-0.5">
                        Ropa ajustada, pies a la anchura de los hombros y brazos relajados a los lados. Para la de atrás, date la vuelta sin moverte de sitio.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => { void hapticTap(); setPhase("analyzing"); }}
                  disabled={!currentImg && !backImg}
                >
                  Analizar mi físico
                </Button>
                <p className="type-footnote text-muted-foreground text-center">
                  Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos
                  fotos el análisis es más completo.
                </p>
                <p className="type-footnote text-muted-foreground text-center">
                  Privado: solo para tu análisis · Sin registro · Menos de 1 minuto
                </p>
              </div>
            </motion.div>
          ) : !result && phase === "goal" ? (
            <motion.div
              key="goal"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 rounded-[22%] bg-card flex items-center justify-center mb-5">
                  <Target className="w-8 h-8 text-primary" strokeWidth={1.75} />
                </div>
                <p className="type-subhead text-muted-foreground mb-1">Paso 2 · Tu objetivo</p>
                <h1 className="type-title1">
                  ¿Cuál es tu <span className="text-primary">objetivo principal</span>?
                </h1>
                <p className="type-subhead text-muted-foreground mt-2">
                  La IA prioriza tu diagnóstico en función de lo que más te importa.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {GOALS.map((g) => {
                  const Icon = g.icon;
                  const active = goal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { void hapticSelection(); setGoal(g.id); }}
                      aria-pressed={active}
                      className={`text-left rounded-2xl p-4 min-h-[72px] transition-colors duration-100 active:bg-accent flex items-start gap-4 ${
                        active ? "bg-card ring-2 ring-primary" : "bg-card"
                      }`}
                    >
                      <div className="w-10 shrink-0 flex items-center justify-center pt-0.5">
                        <Icon className="w-7 h-7 text-primary" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <div className="type-headline">{g.label}</div>
                        <div className="type-subhead text-muted-foreground mt-0.5">{g.desc}</div>
                      </div>
                      {active && <CheckCircle2 className="w-5 h-5 text-primary ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col items-center gap-2 mt-8 max-w-md mx-auto">
                <Button
                  size="lg"
                  disabled={!goal}
                  onClick={() => { void hapticTap(); setPhase("analyzing"); }}
                  className="w-full"
                >
                  Analizar mi físico
                </Button>
                <Button variant="plain" onClick={() => { void hapticTap(); setPhase("upload"); }}>
                  Volver
                </Button>
              </div>
            </motion.div>
          ) : !result && phase === "analyzing" ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="max-w-xl mx-auto text-center pt-12"
            >
              <ProgressRing value={scanProgress} size={128} stroke={8} className="mx-auto mb-8" label="Progreso del análisis">
                <Brain className="w-10 h-10 text-primary" strokeWidth={1.75} />
              </ProgressRing>
              <h2 className="type-title1 mb-3">
                Analizando tu físico
              </h2>
              <AnimatePresence mode="wait">
                <motion.div
                  key={loadingMsgIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="type-callout text-primary flex items-center justify-center gap-2"
                >
                  <Spinner size="sm" />
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </motion.div>
              </AnimatePresence>
              <div className="type-subhead font-rounded tabular-nums text-muted-foreground mt-6">{Math.round(scanProgress)}%</div>
            </motion.div>
          ) : !result && phase === "lead" ? (
            <motion.div
              key="lead"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="max-w-lg mx-auto"
            >
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 rounded-[22%] bg-card flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-8 h-8 text-success" strokeWidth={1.75} />
                </div>
                <p className="type-subhead text-muted-foreground mb-1">Diagnóstico listo</p>
                <h2 className="type-title1 mb-3">
                  Hemos detectado tus <span className="text-primary">principales prioridades físicas</span>.
                </h2>
                <p className="type-subhead text-muted-foreground">
                  Dinos tu nombre y tu email y te lo mostramos ahora mismo. También te lo
                  enviamos por correo para que lo tengas guardado.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="type-footnote text-muted-foreground mb-1.5 block">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    maxLength={100}
                    placeholder="Tu nombre"
                    className="field w-full" autoCapitalize="words" autoComplete="name" enterKeyHint="next"
                  />
                </div>
                <div>
                  <label className="type-footnote text-muted-foreground mb-1.5 block">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      maxLength={255}
                      placeholder="tu@email.com"
                      className="field w-full pl-10" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" enterKeyHint="done"
                    />
                  </div>
                  <p className="type-footnote text-muted-foreground mt-1.5">
                    Te enviamos una copia aquí. Sin tarjeta y sin compromiso.
                  </p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer select-none py-1 min-h-11 active:opacity-70">
                  <input
                    type="checkbox"
                    checked={leadConsent}
                    onChange={(e) => setLeadConsent(e.target.checked)}
                    className="mt-0.5 w-5 h-5 accent-primary cursor-pointer shrink-0"
                  />
                  <span className="type-footnote text-muted-foreground">
                    Acepto que Autopilot use mi foto solo para generar mi diagnóstico físico y acepto la{" "}
                    <Link to="/legal/privacidad" className="text-primary">
                      política de privacidad
                    </Link>
                    .
                  </span>
                </label>

                <Button
                  size="lg"
                  onClick={() => { void hapticTap(); submitLead(); }}
                  disabled={submittingLead || !pendingResult}
                  className="w-full"
                >
                  {submittingLead ? (
                    <>
                      <Spinner className="mr-1" />
                      Enviando…
                    </>
                  ) : !pendingResult ? (
                    <>
                      <Spinner className="mr-1" />
                      Generando tu diagnóstico…
                    </>
                  ) : (
                    <>
                      Ver mi diagnóstico ahora
                    </>
                  )}
                </Button>

                <div className="flex items-start gap-2 pt-1">
                  <Shield className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="type-footnote text-muted-foreground">
                    Tu foto no se publica ni se comparte con otros usuarios. Se usa para tu análisis y se guarda en tu
                    cuenta privada; puedes eliminarla cuando quieras.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {user && routeUserId && !inline && <ScanProgressPanel userId={user.id} compact />}
              {user && routeUserId && !inline && (
                <BeforeAfterCompare
                  userId={user.id}
                  currentPhoto={currentImg}
                  currentScores={{
                    physique: result.physique,
                    attractiveness: result.attractiveness,
                    potential: result.potential,
                  }}
                />
              )}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary mb-4">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span className="type-footnote font-semibold text-success">
                    Análisis completo
                  </span>
                </div>
                <h2 className="type-title1 font-rounded tabular-nums mb-3">
                  Tu <span className="text-primary">AI Physique Report</span>
                </h2>
                {result.headline_diagnosis ? (
                  <p className="text-lg sm:text-xl text-foreground max-w-2xl mx-auto font-medium leading-snug">
                    "{result.headline_diagnosis}"
                  </p>
                ) : (
                  <p className="text-muted-foreground max-w-2xl mx-auto">{result.summary}</p>
                )}
                <div className="mt-5 flex justify-center">
                  {user && userEmail && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resendByEmail}
                      disabled={emailSending || autoSaving}
                      className="mr-2"
                    >
                      {emailSending || autoSaving ? <Spinner size="sm" className="mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
                      {autoSaved ? "Reenviar por email" : "Enviar por email"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    disabled={sharing}
                    className="active:opacity-70"
                  >
                    {sharing ? (
                      <Spinner size="sm" className="mr-1" />
                    ) : (
                      <Share2 className="w-4 h-4 mr-1" />
                    )}
                    Compartir mi resultado
                  </Button>
                  {user && routeUserId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetProgress}
                      disabled={resettingProgress}
                      className="ml-2 text-destructive"
                    >
                      {resettingProgress ? (
                        <Spinner size="sm" className="mr-1" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-1" />
                      )}
                      Resetear progreso
                    </Button>
                  )}
                </div>
              </div>

              {/* Estado de aplicación al plan */}
              {routeUserId && user && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-3xl mx-auto mb-6"
                >
                  <div
                    className="rounded-2xl bg-card px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    {planApplyState === "idle" && (
                      <>
                        <div className="type-subhead flex-1">
                          <div className="font-medium">Tu plan sigue igual</div>
                          <div className="type-caption1 text-muted-foreground">
                            El scan no cambia nada por sí solo. Aplícalo solo si te encaja.
                          </div>
                        </div>
                        {!hasScanInferences(result) ? (
                          <div className="type-caption1 text-muted-foreground">
                            Este scan no propone cambios, así que no hay nada que aplicar.
                          </div>
                        ) : canApplyPlan ? (
                          <Button
                            size="default"
                            variant="secondary"
                            onClick={() => { void hapticTap(); applyScanToPlan(result); }}
                            className="w-full sm:w-auto"
                          >
                            Aplicar a mi plan
                          </Button>
                        ) : (
                          <div className="type-caption1 text-muted-foreground">
                            {plans.plus
                              ? "Ajustar tu plan con cada scan es parte de Plus."
                              : "Tu plan gratuito mantiene su rutina inicial."}
                          </div>
                        )}
                      </>
                    )}
                    {planApplyState === "applying" && (
                      <>
                        <Spinner size="sm" />
                        <div className="type-subhead">
                          <div className="font-medium">Aplicando el scan a tu plan…</div>
                          <div className="type-caption1 text-muted-foreground">Recalculando entrenamiento y nutrición con los datos del scan.</div>
                        </div>
                      </>
                    )}
                    {planApplyState === "success" && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="type-subhead flex-1">
                          <div className="font-semibold text-primary">Plan actualizado correctamente</div>
                          <div className="type-caption1 text-muted-foreground">Tu nuevo entrenamiento y nutrición ya están en tu cuenta.</div>
                        </div>
                        <Button size="default" variant="hero" onClick={() => { void hapticTap(); navigate("/dashboard"); }}>
                          Ver mi plan
                        </Button>
                      </>
                    )}
                    {planApplyState === "sent" && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="type-subhead flex-1">
                          <div className="font-semibold text-primary">Scan enviado a tu entrenador</div>
                          <div className="type-caption1 text-muted-foreground">Tu entrenador ajustará tu plan con este scan.</div>
                        </div>
                      </>
                    )}
                    {planApplyState === "error" && (
                      <>
                        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                        <div className="type-subhead flex-1">
                          <div className="font-medium">No se pudo aplicar al plan</div>
                          <div className="type-caption1 text-muted-foreground">Tu plan no ha cambiado. Vuelve a intentarlo cuando quieras.</div>
                        </div>
                        <Button size="default" variant="secondary" onClick={() => { void hapticTap(); applyScanToPlan(result); }}>
                          Reintentar
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* HERO STATS — tiempo estimado al objetivo (solo si hay físico objetivo) */}
              {(() => {
                const hasObjective = !!objectiveImg || !!savedObjectiveUrl;
                const showMonths = hasObjective && result.months_with_plan !== undefined;
                if (!showMonths) return null;
                return (
                <div className="mx-auto mb-8 grid sm:grid-cols-1 gap-3 max-w-sm">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card rounded-2xl p-5 text-center"
                  >
                    <Clock className="w-4 h-4 text-primary mx-auto mb-2" />
                    <div className="type-group-header text-muted-foreground mb-1">
                      A tu objetivo
                    </div>
                    <div className="type-title1 font-rounded tabular-nums text-primary">
                      {Math.max(1, result.months_with_plan!)}m
                    </div>
                    {result.months_without_plan !== undefined && (
                      <div className="type-caption1 text-muted-foreground mt-1">
                        vs <span className="line-through">{Math.max(2, result.months_without_plan)}m</span> sin plan
                      </div>
                    )}
                  </motion.div>
                </div>
                );
              })()}

              <p className="max-w-2xl mx-auto -mt-4 mb-8 type-caption1 text-muted-foreground text-center px-4">
                Orientación visual aproximada. No sustituye una valoración profesional.
              </p>

              {result.bottleneck && (
                <div className="max-w-3xl mx-auto mb-10">
                  <div className="bg-card rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="type-group-header text-muted-foreground mb-0.5">
                        Lo que más te frena
                      </div>
                      <div className="type-subhead font-medium">{result.bottleneck}</div>
                    </div>
                  </div>
                </div>
              )}

              <ScanCoverageCard
                hasFront={!!currentImg}
                hasBack={!!backImg}
                confidence={result.confidence}
                photoQualityNotes={result.photo_quality_notes}
              />

              <ScanRecommendations
                bottleneck={result.bottleneck}
                improvements={result.improvements}
                monthsWithPlan={result.months_with_plan}
              />

              <div className="grid lg:grid-cols-2 gap-6 w-full mx-auto">
                {/* Photos + similarity */}
                <div className="space-y-4">
                  {(() => {
                    const shots: { src: string; label: string; primary?: boolean }[] = [];
                    if (currentImg) shots.push({ src: currentImg, label: "Actual" });
                    if (objectiveImg) shots.push({ src: objectiveImg, label: "Objetivo", primary: true });
                    else if (backImg) shots.push({ src: backImg, label: "Espalda" });
                    return (
                      <div className={`grid gap-3 ${shots.length > 1 ? "grid-cols-2" : "grid-cols-1 sm:max-w-[320px]"}`}>
                        {shots.map((p) => (
                          <div
                            key={p.label}
                            className={`relative aspect-[3/4] rounded-2xl overflow-hidden ${p.primary ? "ring-2 ring-primary/50" : ""}`}
                          >
                            <img loading="lazy" decoding="async" src={p.src} alt={p.label.toLowerCase()} className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 inset-x-0 bg-background/80 p-2">
                              <div className={`type-group-header ${p.primary ? "text-primary" : "text-muted-foreground"}`}>
                                {p.label}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {objectiveImg && (
                    <div className="bg-card rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2 type-caption1">
                        <span className="text-muted-foreground">Similitud al objetivo</span>
                        <span className="font-bold text-primary">{result.similarity}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.similarity}%` }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          className="h-full bg-primary"
                        />
                      </div>
                      <div className="mt-3 type-caption1 text-muted-foreground">
                        Tiempo estimado:{" "}
                        <span className="text-foreground font-semibold">
                          ~{result.estimated_months ?? result.months_with_plan ?? "—"} meses
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

                  <div className="bg-card rounded-2xl p-4">
                    <div className="type-group-header text-muted-foreground mb-3 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3" /> Mejoras detectadas
                    </div>
                    <ul className="space-y-2">
                      {result.improvements.map((m, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center justify-between type-subhead"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {m.label}
                          </span>
                          <span
                            className={`type-caption2 px-2 py-0.5 rounded-full ${
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
                  <div className="bg-card rounded-2xl p-4 relative overflow-hidden">
                    <div className="type-group-header text-primary mb-3 flex items-center gap-1.5">
                      {isPaid ? <Sparkles className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {result.months_with_plan ?? result.estimated_months
                        ? <>Tu yo en {result.months_with_plan ?? result.estimated_months} meses</>
                        : <>Tu yo transformado</>}
                    </div>
                    {currentImg && backImg && (
                      <div className="flex gap-1 mb-3 p-1 rounded-full bg-secondary w-fit" role="tablist" aria-label="Vista de la simulación">
                        {(["front", "back"] as const).map((p) => (
                          <button key={p} role="tab" aria-selected={simPose === p} onClick={() => setSimPose(p)}
                            className={`min-h-9 px-4 rounded-full type-caption1 font-semibold transition ${simPose === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                            {p === "front" ? "Frente" : "Espalda"}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="relative aspect-[3/2] rounded-xl overflow-hidden bg-secondary">
                      {futureImg ? (
                        <img loading="lazy" decoding="async" src={futureImg} alt="futuro IA" className="w-full h-full object-cover" />
                      ) : simBase ? (
                        <img loading="lazy" decoding="async"
                          src={simBase}
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
                          <div className="absolute inset-0 bg-background/80" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                            {isPaid ? (
                              <>
                                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                                  {genLoading ? (
                                    <Spinner />
                                  ) : (
                                    <Sparkles className="w-5 h-5 text-primary" />
                                  )}
                                </div>
                                <Button
                                  variant="hero"
                                  size="default"
                                  onClick={() => generateFuture()}
                                  disabled={genLoading}
                                >
                                  {genLoading ? "Generando con IA…" : "Generar simulación IA"}
                                </Button>
                                <div className="type-caption1 text-muted-foreground max-w-xs">
                                  Tarda ~15s. Misma identidad, físico transformado.
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                                  <Lock className="w-5 h-5 text-primary" />
                                </div>
                                <div className="type-subhead font-semibold">Visualiza tu transformación</div>
                                <div className="type-caption1 text-muted-foreground max-w-xs">
                                  Simulación generada con IA al activar tu plan
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!isPaid && !user && (
                    <LockedInsightsGrid
                      insights={result.locked_insights}
                      onCta={() => navigate(signupWithPlan)}
                    />
                  )}
                </div>
              </div>

              {/* === CAPA DE DETALLE — lectura estimada por IA === */}
              {(result.body_composition || result.muscle_breakdown?.length || result.posture || result.proportions || result.genetic_markers?.length || result.protocol) && (
                <div className="w-full mx-auto mt-10 space-y-4">
                  <div className="text-center mb-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
                      <Gauge className="w-3.5 h-3.5 text-primary" />
                      <span className="type-headline text-primary">
                        Lectura estimada por IA
                      </span>
                    </div>
                    <p className="type-caption1 text-muted-foreground mt-2">
                      Lectura por grupo muscular, composición, postura, proporciones y protocolo accionable a partir de tus
                      fotos. Es una estimación visual, no un diagnóstico médico.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Composición corporal */}
                    {result.body_composition && (
                      <div className="bg-card rounded-2xl p-5">
                        <div className="type-group-header text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Activity className="w-3 h-3" /> Composición corporal estimada
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {result.body_composition.body_fat_pct !== undefined && (
                            <div>
                              <div className="type-title2 font-rounded tabular-nums text-primary">{result.body_composition.body_fat_pct}%</div>
                              <div className="type-caption1 text-muted-foreground">Grasa</div>
                            </div>
                          )}
                          {result.body_composition.lean_mass_kg !== undefined && (
                            <div>
                              <div className="type-title2 font-rounded tabular-nums text-primary">{result.body_composition.lean_mass_kg}kg</div>
                              <div className="type-caption1 text-muted-foreground">Masa magra</div>
                            </div>
                          )}
                          {result.body_composition.weight_kg !== undefined && (
                            <div>
                              <div className="type-title2 font-rounded tabular-nums">{result.body_composition.weight_kg}kg</div>
                              <div className="type-caption1 text-muted-foreground">Peso est.</div>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 type-caption1">
                          {result.body_composition.somatotype && (
                            <div className="bg-secondary/60 rounded-lg px-3 py-2">
                              <div className="type-caption1 text-muted-foreground">Somatotipo</div>
                              <div className="font-medium capitalize">{result.body_composition.somatotype}</div>
                            </div>
                          )}
                          {result.body_composition.frame_size && (
                            <div className="bg-secondary/60 rounded-lg px-3 py-2">
                              <div className="type-caption1 text-muted-foreground">Estructura</div>
                              <div className="font-medium capitalize">{result.body_composition.frame_size}</div>
                            </div>
                          )}
                          {result.body_composition.fat_distribution && (
                            <div className="bg-secondary/60 rounded-lg px-3 py-2 col-span-2">
                              <div className="type-caption1 text-muted-foreground">Distribución de grasa</div>
                              <div className="font-medium capitalize">{result.body_composition.fat_distribution}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Proporciones */}
                    {result.proportions && (
                      <div className="bg-card rounded-2xl p-5">
                        <div className="type-group-header text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Ruler className="w-3 h-3" /> Proporciones y simetría
                        </div>
                        <div className="space-y-3 type-subhead">
                          {result.proportions.shoulder_to_waist_ratio !== undefined && (
                            <div>
                              <div className="flex justify-between type-caption1 mb-1">
                                <span className="text-muted-foreground">Ratio hombro/cintura</span>
                                <span className="font-semibold">{result.proportions.shoulder_to_waist_ratio.toFixed(2)} <span className="text-muted-foreground font-normal">/ ideal ~1.60</span></span>
                              </div>
                              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (result.proportions.shoulder_to_waist_ratio / 1.8) * 100)}%` }} />
                              </div>
                            </div>
                          )}
                          {result.proportions.v_taper_score !== undefined && (
                            <div>
                              <div className="flex justify-between type-caption1 mb-1">
                                <span className="text-muted-foreground">V-taper</span>
                                <span className="font-semibold">{result.proportions.v_taper_score}/10</span>
                              </div>
                              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${result.proportions.v_taper_score * 10}%` }} />
                              </div>
                            </div>
                          )}
                          {result.proportions.symmetry_score !== undefined && (
                            <div>
                              <div className="flex justify-between type-caption1 mb-1">
                                <span className="text-muted-foreground">Simetría</span>
                                <span className="font-semibold">{result.proportions.symmetry_score}/10</span>
                              </div>
                              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${result.proportions.symmetry_score * 10}%` }} />
                              </div>
                            </div>
                          )}
                          {result.proportions.upper_lower_balance && (
                            <div className="type-caption1 bg-secondary/60 rounded-lg px-3 py-2">
                              <span className="text-muted-foreground">Balance: </span>
                              <span className="font-medium">{result.proportions.upper_lower_balance}</span>
                            </div>
                          )}
                          {result.proportions.weakest_link && (
                            <div className="type-caption1 text-primary bg-secondary rounded-lg px-3 py-2">
                              Eslabón más débil: <span className="font-semibold">{result.proportions.weakest_link}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Breakdown por grupo muscular */}
                  {result.muscle_breakdown && result.muscle_breakdown.length > 0 && (
                    <div className="bg-card rounded-2xl p-5">
                      <div className="type-group-header text-muted-foreground mb-4 flex items-center gap-1.5">
                        <Dumbbell className="w-3 h-3" /> Lectura por grupo muscular
                      </div>
                      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
                        {result.muscle_breakdown.map((m, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="pb-2"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="type-subhead font-medium">{m.group}</span>
                              <span className={`type-caption1 font-bold tabular-nums ${m.score >= 7 ? "text-primary" : m.score >= 5 ? "text-foreground" : "text-muted-foreground"}`}>
                                {m.score.toFixed(1)}<span className="text-muted-foreground font-normal">/10</span>
                              </span>
                            </div>
                            <div className="h-1 bg-secondary rounded-full overflow-hidden mb-1.5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${m.score * 10}%` }}
                                transition={{ duration: 0.8, delay: i * 0.04 }}
                                className={`h-full ${m.score >= 7 ? "bg-primary" : "bg-primary/50"}`}
                              />
                            </div>
                            <div className="type-caption1 text-muted-foreground leading-snug">{m.verdict}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Postura */}
                    {result.posture && (result.posture.issues?.length || result.posture.note) && (
                      <div className="bg-card rounded-2xl p-5">
                        <div className="type-group-header text-muted-foreground mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> Postura</span>
                          {result.posture.severity && (
                            <span className={`type-caption1 px-2 py-0.5 rounded-full ${
                              result.posture.severity === "severa" ? "bg-destructive/15 text-destructive" :
                              result.posture.severity === "moderada" ? "bg-primary/15 text-primary" :
                              "bg-secondary text-muted-foreground"
                            }`}>{result.posture.severity}</span>
                          )}
                        </div>
                        {result.posture.issues && result.posture.issues.length > 0 && (
                          <ul className="space-y-1.5 mb-3">
                            {result.posture.issues.map((iss, i) => (
                              <li key={i} className="type-subhead flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                                <span>{iss}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {result.posture.note && (
                          <div className="type-caption1 text-muted-foreground italic">{result.posture.note}</div>
                        )}
                      </div>
                    )}

                    {/* Marcadores visuales (no genéticos) */}
                    {result.genetic_markers && result.genetic_markers.length > 0 && (
                      <div className="bg-card rounded-2xl p-5">
                        <div className="type-group-header text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Dna className="w-3 h-3" /> Rasgos visuales que juegan a tu favor (o en contra)
                        </div>
                        <ul className="space-y-2">
                          {result.genetic_markers.map((g, i) => (
                            <li key={i} className="type-subhead flex items-start gap-2">
                              <span className="text-primary type-caption1 mt-0.5">•</span>
                              <span className="leading-snug">{g}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 type-caption1 text-muted-foreground">
                          Señales observadas en tus fotos: no es un estudio genético.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Protocolo accionable */}
                  {result.protocol && (
                    <div className="bg-card rounded-2xl p-5">
                      <div className="type-group-header text-primary mb-4 flex items-center gap-1.5">
                        <ClipboardList className="w-3 h-3" /> Protocolo recomendado por la IA
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {result.protocol.training_days_per_week !== undefined && (
                          <div className="bg-background/50 rounded-lg px-3 py-2.5 text-center">
                            <div className="text-xl font-rounded font-bold tabular-nums text-primary">{result.protocol.training_days_per_week}</div>
                            <div className="type-caption1 text-muted-foreground">Días/sem</div>
                          </div>
                        )}
                        {result.protocol.weekly_sets_priority !== undefined && (
                          <div className="bg-background/50 rounded-lg px-3 py-2.5 text-center">
                            <div className="text-xl font-rounded font-bold tabular-nums text-primary">{result.protocol.weekly_sets_priority}</div>
                            <div className="type-caption1 text-muted-foreground">Sets prioridad</div>
                          </div>
                        )}
                        {result.protocol.protein_g_per_kg !== undefined && (
                          <div className="bg-background/50 rounded-lg px-3 py-2.5 text-center">
                            <div className="text-xl font-rounded font-bold tabular-nums text-primary">{result.protocol.protein_g_per_kg}g</div>
                            <div className="type-caption1 text-muted-foreground">Proteína/kg</div>
                          </div>
                        )}
                        {result.protocol.calorie_adjustment_kcal !== undefined && (
                          <div className="bg-background/50 rounded-lg px-3 py-2.5 text-center">
                            <div className="text-xl font-rounded font-bold tabular-nums text-primary">
                              {result.protocol.calorie_adjustment_kcal > 0 ? "+" : ""}{result.protocol.calorie_adjustment_kcal}
                            </div>
                            <div className="type-caption1 text-muted-foreground">kcal vs mant.</div>
                          </div>
                        )}
                        {result.protocol.cardio_minutes_per_week !== undefined && (
                          <div className="bg-background/50 rounded-lg px-3 py-2.5 text-center">
                            <div className="text-xl font-rounded font-bold tabular-nums text-primary">{result.protocol.cardio_minutes_per_week}</div>
                            <div className="type-caption1 text-muted-foreground">min cardio/sem</div>
                          </div>
                        )}
                      </div>
                      {result.protocol.key_lifts && result.protocol.key_lifts.length > 0 && (
                        <div className="mb-3">
                          <div className="type-caption1 text-muted-foreground mb-1.5">Ejercicios clave</div>
                          <div className="flex flex-wrap gap-1.5">
                            {result.protocol.key_lifts.map((l, i) => (
                              <span key={i} className="type-caption1 px-2.5 py-1 rounded-full bg-primary/10 text-primary ">
                                {l}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.protocol.avoid && result.protocol.avoid.length > 0 && (
                        <div>
                          <div className="type-caption1 text-muted-foreground mb-1.5">Evita</div>
                          <ul className="space-y-1">
                            {result.protocol.avoid.map((a, i) => (
                              <li key={i} className="type-caption1 flex items-start gap-2 text-muted-foreground">
                                <X className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Proyección + prueba social — antes del CTA final */}
              {!isPaid && !user && (
                <ProjectionTimeline
                  currentScore={result.physique}
                  monthsWithPlan={result.months_with_plan ?? result.estimated_months}
                  monthsWithoutPlan={result.months_without_plan}
                  priorities={(result.improvements || []).slice(0, 3).map((i) => i.label)}
                  bottleneck={result.bottleneck}
                  onCta={() => navigate(signupWithPlan)}
                />
              )}
              {!isPaid && !user && <SocialProofStrip />}

              {/* FUNNEL CTA */}
              {!isPaid && !user ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="relative w-full mx-auto mt-16"
              >
                <div className="relative bg-card rounded-2xl p-8 sm:p-12 text-center overflow-hidden">
                  <div className="relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary mb-5">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <span className="type-headline text-primary">
                        Siguiente paso
                      </span>
                    </div>
                    <h3 className="type-title1 mb-4">
                      {(result.months_with_plan ?? result.estimated_months) ? (
                        <>
                          Llega ahí en{" "}
                          <span className="text-primary">
                            {result.months_with_plan ?? result.estimated_months} meses
                          </span>
                          {result.months_without_plan !== undefined && (
                            <>, no en {result.months_without_plan}</>
                          )}
                        </>
                      ) : (
                        <>
                          Convierte el diagnóstico en{" "}
                          <span className="text-primary">resultados reales</span>
                        </>
                      )}
                    </h3>
                    <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                      La IA detectó {result.improvements.length} puntos críticos y tu cuello de botella exacto.
                      Te proponemos el plan de entrenamiento + nutrición que los ataca, ajustado a ti. Sin cambios de fondo,
                      lo más probable es que el siguiente scan siga pareciéndose a este.
                    </p>
                    <div className="flex items-baseline justify-center gap-3 mb-5">
                      <span className="type-title1 font-rounded tabular-nums text-primary">Desde {euro(plans.plus ? plans.plusPrice : plans.coachPrice)}/mes</span>
                      <span className="type-footnote text-primary">{TRIAL_DAYS} días de prueba</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      {(() => {
                        const { rec } = recommendFor({
                          bottleneck: result.bottleneck,
                          improvements: result.improvements,
                          monthsWithPlan: result.months_with_plan,
                          plans,
                        });
                        const to = user ? "/dashboard" : rec.kind === "plan" ? `${rec.to}&from=scan` : rec.to;
                        return (
                          <Button variant="hero" size="xl" onClick={() => navigate(to)} className="active:scale-[0.98]">
                            {user ? "Volver a mi cuenta" : `Empezar con ${rec.name}`}
                            <ArrowRight className="w-4 h-4 transition-transform" />
                          </Button>
                        );
                      })()}
                      <Button variant="outline" size="xl" onClick={reset}>
                        Hacer otro scan
                      </Button>
                    </div>
                    {!user && (
                      <p className="type-caption1 text-muted-foreground mt-3">
                        7 días de prueba en los planes mensuales · Requiere tarjeta · No se cobra hasta el día 8
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-6 justify-center type-caption1 text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        Cancela en 1 clic
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        Sin permanencia
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        Garantía {GUARANTEE_DAYS} días
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
              ) : (
                <div className="max-w-2xl mx-auto mt-12 flex flex-col sm:flex-row gap-3 justify-center">
                  {routeUserId && user && canApplyPlan && hasScanInferences(result) && (planApplyState === "idle" || planApplyState === "error") && (
                    <Button
                      variant="secondary"
                      size="xl"
                      onClick={() => applyScanToPlan(result)}
                    >
                      Aplicar a mi plan
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                  {routeUserId && (
                    <Button variant="secondary" size="xl" onClick={() => navigate("/dashboard")}>
                      Ver mi plan
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                  {!routeUserId && user && (
                    <Button variant="secondary" size="xl" onClick={() => navigate(`/scan/user/${user.id}`)}>
                      Ir a mi progreso
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                  {!routeUserId && !user && (
                    <Button variant="hero" size="xl" onClick={() => navigate(signupWithPlan)}>
                      Empezar mi plan
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
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

                  {(currentImg || backImg) && (() => {
                    const photos: { src: string; label: string }[] = [];
                    if (currentImg) photos.push({ src: currentImg, label: "Frente" });
                    if (backImg) photos.push({ src: backImg, label: "Espalda" });
                    if (objectiveImg) photos.push({ src: objectiveImg, label: "Objetivo" });
                    const count = photos.length;
                    const w = count === 1 ? 460 : count === 2 ? 420 : 300;
                    const h = count === 1 ? 580 : count === 2 ? 540 : 400;
                    return (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: count === 3 ? 18 : 24 }}>
                        {photos.map((p) => (
                          <React.Fragment key={p.label}>
                            {p.label === "Objetivo" && count >= 2 && (
                              <div
                                style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 999,
                                  background: "rgba(250,204,21,0.15)",
                                  border: "1px solid rgba(250,204,21,0.5)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 24,
                                  color: "#facc15",
                                  flexShrink: 0,
                                }}
                              >
                                →
                              </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                              <img loading="lazy" decoding="async"
                                src={p.src}
                                style={{
                                  width: w,
                                  height: h,
                                  borderRadius: 24,
                                  objectFit: "cover",
                                  border: p.label === "Objetivo" ? "2px solid #facc15" : "2px solid rgba(250,204,21,0.7)",
                                  boxShadow: "0 0 60px rgba(250,204,21,0.22)",
                                }}
                              />
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#facc15", textTransform: "uppercase", letterSpacing: 3 }}>
                                {p.label}
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    );
                  })()}

                  <div>
                    <div style={{ fontSize: 22, color: "#a1a1aa", marginBottom: 18, textTransform: "uppercase", letterSpacing: 3 }}>
                      Diagnóstico
                    </div>
                    <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }}>
                      "{(result.headline_diagnosis ?? result.summary ?? "").slice(0, 110)}{((result.headline_diagnosis ?? result.summary ?? "").length > 110) ? "…" : ""}"
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                    {result.months_with_plan !== undefined && result.months_with_plan > 0 && (
                      <StatBox
                        label="A mi objetivo"
                        value={`${Math.max(1, result.months_with_plan)}m`}
                        sub={
                          result.months_without_plan !== undefined
                            ? `vs ${Math.max(2, result.months_without_plan)}m sin plan`
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
    </>
  );

  if (inline) return <div className="relative w-full">{scanBody}</div>;

  if (embedded) {
    return (
      <MobileAppShell
        title="Análisis IA"
        active="progress"
        userId={user.id}
        onChange={(t) => { try { sessionStorage.setItem("autopilot_section", t); } catch { /* sin storage */ } navigate("/dashboard"); }}
        onSettings={() => { try { sessionStorage.setItem("autopilot_section", "settings"); } catch { /* sin storage */ } navigate("/dashboard"); }}
      >
        <div className="relative w-full">{scanBody}</div>
      </MobileAppShell>
    );
  }

  return (
    <SidebarProvider>
    <div className="min-h-screen bg-background relative overflow-hidden flex w-full">
      {user && <UserSidebar section="progress" onNavigate={(s) => navigate(s === "progress" ? `/scan/user/${user.id}` : "/dashboard")} onSignOut={() => { void supabase.auth.signOut(); navigate("/"); }} />}
      <div className="flex-1 min-w-0 relative">
      {scanBody}
      </div>
    </div>
    </SidebarProvider>
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
