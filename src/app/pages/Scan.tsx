import { errorMessage } from "@/shared/lib/runtimeValues";
import { scanErrorMessage } from "@/shared/lib/scanErrors";
import { SCAN_REVEAL_MS, type ScanStage } from "@/shared/lib/scanLoading";
import { dashboardDestination } from "@/shared/lib/dashboardDestination";
import ScanAnalyzing from "@/app/components/scan/ScanAnalyzing";
import { formatDecimal } from "@/shared/lib/numberFormat";
import { compressImage, toBrowserFriendlyImage } from "@/shared/lib/imageCompression";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import UserSidebar from "@/app/components/UserSidebar";
import MobileAppShell from "@/app/components/mobile/MobileAppShell";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { recordAcquisitionEvent } from "@/shared/lib/acquisition";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  Target,
  Lock,
  AlertTriangle,
  Dumbbell,
  Flame,
  RefreshCw,
  Activity,
  Sprout,
} from "lucide-react";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { cn } from "@/shared/lib/utils";
import { SCAN_GOAL_LABELS, improvementList, monthsText, objectiveMonths, scoreText } from "@/shared/lib/scanResultFormat";
import { groupedInt } from "@/shared/lib/workoutSummaryFormat";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Checkbox } from "@/shared/components/ui/checkbox";
import NavBar from "@/shared/components/native/NavBar";
import { hapticNotify, hapticTap, hapticSelection } from "@/shared/lib/native";
import { supabase } from "@/shared/integrations/supabase/client";
import { applyScanPlan, canApplyScanToPlan, hasScanInferences, parseScanProtocol, scanPriorities, userSpecificGoal, type ScanApplyResult } from "@/shared/lib/scanApply";
import { toast } from "sonner";
import { useAuth } from "@/shared/contexts/AuthContext";
import ProjectionTimeline from "@/app/components/scan/ProjectionTimeline";
import LockedInsightsGrid from "@/app/components/scan/LockedInsightsGrid";
import ScanApplyPlanCard from "@/app/components/scan/ScanApplyPlanCard";
import StickyConversionBar from "@/app/components/scan/StickyConversionBar";
import ScanCoverageCard from "@/app/components/scan/ScanCoverageCard";
import ScanResultView from "@/app/components/scan/ScanResultView";
import { ScanShareButton, renderScanStoryDataUrl } from "@/app/components/scan/ScanShareCard";
import { ScanErrorNotice, ScanObjectivePicker, ScanPhotoTile, ScanPrivacyNote, ScanTips } from "@/app/components/scan/ScanUploadParts";
import ScanRecommendations, { recommendFor } from "@/app/components/scan/ScanRecommendations";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import SocialProofStrip from "@/app/components/scan/SocialProofStrip";
import ScanProgressPanel from "@/app/components/scan/ScanProgressPanel";
import BeforeAfterCompare from "@/app/components/scan/BeforeAfterCompare";
import { FindingRow, ScanImage } from "@/app/components/scan/ScanResultParts";
import { signedUrlFor, signedUrlsFor } from "@/shared/lib/storageSign";
import { toLocalDateString } from "@/shared/lib/localDates";
import { clearAnonScanId, getOrCreateAnonScanId } from "@/shared/lib/scanAttribution";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { clearPendingScanContext, markPendingScanRestored, readPendingScanContext } from "@/shared/lib/pendingScan";

type Phase = "upload" | "analyzing" | "lead";

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

// El objetivo se guarda por id ("gain_muscle", "lose_weight"…): en pantalla siempre su nombre, nunca el id.
const goalLabel = (value: string | null) =>
  GOALS.find((goal) => goal.id === value)?.label ?? (value ? SCAN_GOAL_LABELS[value] : undefined) ?? value;

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
  /** Scan básico (Free y visitantes): el servidor quita el detalle de Plus. */
  basic?: boolean;
  locked_sections?: string[];
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

// HEIC (cámara del iPhone) se pasa antes a JPEG: si no, la foto guardada no se ve luego.
// Luego se reduce a 1600 px como en la app: el servidor reconoce la misma foto venga del
// dispositivo que venga (mismo resultado) y la subida pesa mucho menos.
const fileToDataUrl = async (input: File): Promise<string> => {
  const file = await compressImage(await toBrowserFriendlyImage(input), { maxDimension: 1600, quality: 0.85 });
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
};

const sentenceCase = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** «Ahora prioriza hombros y pecho.» con los grupos que se aplicaron. */
const priorityLine = (muscles: string[]) =>
  muscles.length ? `Ahora prioriza ${muscles.map((m) => m.toLowerCase()).join(" y ")}.` : null;

type PlanApplyCopy = { title: string; description: string; tone: "ok" | "warn" };

const Scan = ({ inline = false, onOpenPlan, onStartWorkout, onPlanChanged }: { inline?: boolean; onOpenPlan?: () => void; onStartWorkout?: () => void; onPlanChanged?: () => void } = {}) => {
  const plans = usePlanAvailability();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const openDashboard = (section: import("@/app/components/mobile/MobileTabBar").MobileTab) => {
    if (!user) return;
    navigate(dashboardDestination(user.id, section));
  };
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const routeUserId = inline ? user?.id : paramUserId;
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      // Si intenta acceder al espacio personal sin sesión, mándalo a login.
      if (routeUserId) {
        navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
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
  const [scanStage, setScanStage] = useState<ScanStage>("analyzing");
  const [scanError, setScanError] = useState<string | null>(null);
  // Con «reducir movimiento», sin pausa antes del resultado ni deslizamiento (como Progreso → Scan y la app).
  const reduceMotion = useReducedMotion();
  const revealMs = reduceMotion ? 0 : SCAN_REVEAL_MS;
  const [result, setResult] = useState<Result | null>(null);
  const [futureImgs, setFutureImgs] = useState<{ front?: string; back?: string }>({});
  const [simPoseChoice, setSimPose] = useState<"front" | "back">("front");
  // Simulamos solo las vistas subidas: si solo hay espalda, espalda; si solo frente, frente.
  const simPose: "front" | "back" = currentImg && backImg ? simPoseChoice : backImg && !currentImg ? "back" : "front";
  const simBase = simPose === "back" ? backImg : currentImg;
  const futureImg = futureImgs[simPose] ?? null;
  const [genLoading, setGenLoading] = useState(false);
  const [planApplyState, setPlanApplyState] = useState<"idle" | "applying" | "done" | "sent" | "error">("idle");
  const [planApplyCopy, setPlanApplyCopy] = useState<PlanApplyCopy | null>(null);
  // Cada aplicación lleva un número: si entretanto empieza otro scan, su resultado ya no se pinta.
  const applyRun = useRef(0);
  // Una aplicación en marcha (aunque se empiece otro scan) y el último resultado, para «Reintentar».
  const applyInFlight = useRef(false);
  const lastApply = useRef<ScanApplyResult | null>(null);
  // Objetivo y objetivo concreto del usuario: el botón solo aparece si el scan trae algo nuevo para él.
  const [scanOnboarding, setScanOnboarding] = useState<{ goal: string | null; specific_goal: string | null } | null>(null);
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
  const [userBiometrics, setUserBiometrics] = useState<{
    height?: number;
    weight?: number;
    age?: number;
    gender?: string;
  }>({});

  // Funnel state
  const [phase, setPhase] = useState<Phase>("upload");
  const [goal, setGoal] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<Result | null>(null);
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
      .select("goal_photo_url, goal, specific_goal, height, weight, age, sex")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUserBiometrics({
            height: data.height ? Number(data.height) : undefined,
            weight: data.weight ? Number(data.weight) : undefined,
            age: data.age ? Number(data.age) : undefined,
            gender: data.sex || undefined,
          });
        }
        const url = data?.goal_photo_url ?? null;
        if (url) {
          setSavedObjectivePath(url);
          // Bucket es privado: firmar la URL para visualización y para enviar al análisis IA.
          import("@/shared/lib/storageSign").then(({ signedUrlFor }) =>
            signedUrlFor("progress-photos", url).then((signed) => {
              const finalUrl = signed || url;
              setSavedObjectiveUrl(finalUrl);
              setObjectiveImg((prev) => prev ?? finalUrl);
            })
          );
        }
        setScanOnboarding({ goal: data?.goal ?? null, specific_goal: data?.specific_goal ?? null });
        const txt = (userSpecificGoal(data?.specific_goal) || data?.goal || "").toString().trim();
        if (txt) setSavedGoalText(txt);
      });
  }, [user]);

  // Tras verificar la cuenta en la misma pestaña, el análisis que se hizo sin
  // cuenta sigue en sessionStorage. Se restaura para no repetir la IA (y para
  // poder aplicarlo al plan desde el espacio personal). Si la verificación se
  // abrió en otro dispositivo no hay contexto: ese caso necesita una
  // reclamación server-side por email verificado (pendiente).
  const restoredPendingScan = useRef(false);
  useEffect(() => {
    if (restoredPendingScan.current || !user || inline || routeUserId) return;
    restoredPendingScan.current = true;
    const pending = readPendingScanContext();
    // Solo restauramos el contexto de un scan anónimo que llegó al formulario
    // de lead (los scans de una cuenta ya tienen su historial guardado).
    if (!pending?.leadEmail) return;
    setCurrentImg((prev) => prev ?? pending.currentImg ?? null);
    setObjectiveImg((prev) => prev ?? pending.objectiveImg ?? null);
    setResult(pending.result as Result);
    if (!pending.restored) {
      toast.info("Recuperamos el análisis que hiciste antes de crear tu cuenta.");
      markPendingScanRestored();
    }
  }, [user, inline, routeUserId]);

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

  // Sube la imagen del scan (la misma de «Compartir resumen») vía edge function y devuelve una
  // URL firmada temporal: vive en un bucket privado y el enlace del email caduca a los 7 días.
  const uploadScanCard = async (r: Result): Promise<string | null> => {
    try {
      const dataUrl = await renderScanStoryDataUrl(r);
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

  // Foto elegida: HEIC a JPEG y reducida a 1600 px; si no se puede abrir, se dice (sin dejar la anterior).
  const pickPhoto = async (file: File, set: (v: string | null) => void) => {
    try {
      set(await fileToDataUrl(file));
      setScanError(null);
    } catch {
      setScanError("No se pudo abrir esa foto. Prueba con otra.");
    }
  };

  const pickObjective = async (file: File) => {
    void hapticTap();
    try {
      const dataUrl = await fileToDataUrl(file);
      setObjectiveImg(dataUrl);
      setSelectedPresetId(null);
      setScanError(null);
      if (user && routeUserId) await saveCustomGoalPreset(dataUrl);
    } catch {
      setScanError("No se pudo abrir esa foto. Prueba con otra.");
    }
  };

  const handleAnalyze = async () => {
    if (!currentImg && !backImg) {
      toast.error("Sube al menos una foto: de delante, de atrás o las dos");
      return;
    }
    setLoading(true);
    setScanStage("analyzing");
    setScanError(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-physique", {
        body: {
          currentImage: currentImg,
          backImage: backImg,
          objectiveImage: objectiveImg,
          height_cm: userBiometrics.height,
          weight_kg: userBiometrics.weight,
          age: userBiometrics.age,
          gender: userBiometrics.gender,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Todos los pasos marcados: el último check se ve un instante antes del resultado (como la app).
      setScanStage("done");
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
      void recordAcquisitionEvent("scan");
      // Con cuenta se salta el formulario (ya tenemos su email): resultado y, detrás, historial y email.
      // El plan NUNCA se toca solo: lo aplica el usuario con «Aplicar a mi plan».
      if (user) {
        setTimeout(() => {
          void hapticNotify("success");
          setResult(r);
          saveAndEmailScan(r, { silent: !isPaid });
        }, revealMs);
      }
      // Sin cuenta, el efecto del paso "analyzing" pasa a "lead".
    } catch (e: unknown) {
      console.error(e);
      void hapticNotify("error");
      // El motivo del servidor solo elige el aviso (igual que en la app): nunca se enseña tal cual.
      setScanError(await scanErrorMessage(e));
      setPhase("upload");
    } finally {
      setLoading(false);
    }
  };

  // Kick off analysis when entering "analyzing" phase
  useEffect(() => {
    if (phase === "analyzing" && !loading && !pendingResult && (currentImg || backImg)) {
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Sin cuenta, del análisis al formulario con la misma pausa que el resultado de la app.
  useEffect(() => {
    if (phase !== "analyzing" || !pendingResult) return;
    if (user) return; // logueados van directos al resultado, sin formulario de lead
    const t = setTimeout(() => { void hapticNotify("success"); setPhase("lead"); }, revealMs);
    return () => clearTimeout(t);
  }, [phase, pendingResult, user, revealMs]);

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
          const cardImageUrl = await uploadScanCard(r);
          const { error: emailError } = await supabase.functions.invoke("send-scan-diagnosis", {
            body: {
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
                reportUrl: "https://autopilotplan.com/onboarding",
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

  // «Ver mi plan» abre la pestaña Plan con la rutina semanal. Dentro del Dashboard
  // cambia de pestaña al momento; fuera, deja la pestaña elegida antes de navegar.
  const openPlan = () => {
    void hapticTap();
    if (onOpenPlan) {
      onOpenPlan();
      return;
    }
    try {
      sessionStorage.setItem("autopilot_section", "training");
      sessionStorage.setItem("autopilot_training_view", "plan");
    } catch { /* sin almacenamiento */ }
    const target = user ? `/dashboard/user/${user.id}?section=training&view=plan` : "/dashboard?section=training&view=plan";
    navigate(target);
  };

  const startWorkoutFromScan = () => {
    void hapticTap();
    // Empezar el entreno no cambia el plan: aplicar el scan es una decisión
    // explícita en la tarjeta, para que nadie entrene con una rutina distinta
    // de la que acaba de elegir.
    if (onStartWorkout) {
      onStartWorkout();
      return;
    }
    try {
      sessionStorage.setItem("autopilot_section", "training");
      sessionStorage.setItem("autopilot_training_view", "tracker");
    } catch { /* sin almacenamiento */ }
    const target = user
      ? `/dashboard/user/${user.id}?section=training&view=tracker&autostart=true`
      : `/dashboard?section=training&view=tracker&autostart=true`;
    navigate(target);
  };

  const applyScanToPlan = async (r: Result, retry = false) => {
    if (!user || planApplyState === "applying") return;
    if (applyInFlight.current) {
      toast.info("Espera a que termine de aplicarse el scan anterior");
      return;
    }
    applyInFlight.current = true;
    const run = ++applyRun.current;
    setPlanApplyState("applying");
    const res: ScanApplyResult = await applyScanPlan(supabase, user.id, r, { retryOf: retry ? lastApply.current : null })
      .catch((e: unknown) => {
        console.error("applyScanToPlan", e);
        return { outcome: "failed" as const, priorities: [] };
      })
      .finally(() => { applyInFlight.current = false; });
    if (res.saved) setScanOnboarding(res.saved);
    const outcome = res.outcome;
    if (run !== applyRun.current) {
      // «Hacer otro scan» durante la aplicación: la pantalla ya es de otro scan, pero se avisa de cómo acabó.
      onPlanChanged?.();
      if (outcome === "session_expired") {
        toast.error("Tu sesión ha caducado. Inicia sesión de nuevo.");
        await supabase.auth.signOut({ scope: "local" });
        navigate(`/login?next=${encodeURIComponent(scanBasePath)}`);
      } else if (outcome === "kept") {
        setCanApplyPlan(false);
      } else if (outcome === "applied" || outcome === "nutrition_only") {
        toast.success("El scan anterior se aplicó a tu plan");
      } else if (outcome === "failed" || outcome === "unknown") {
        toast.info("No pudimos confirmar si el scan anterior se aplicó");
      }
      return;
    }
    const done = (copy: PlanApplyCopy, toastText: string) => {
      setPlanApplyCopy(copy);
      setPlanApplyState("done");
      if (copy.tone === "warn") toast.info(toastText); else toast.success(toastText);
      onPlanChanged?.();
    };
    lastApply.current = res;
    switch (outcome) {
      case "applied": {
        const priorities = priorityLine(res.priorities);
        const protocol = parseScanProtocol(r.protocol);
        const hasNutrition = protocol?.proteinPerKg !== undefined || protocol?.calorieAdjustmentKcal !== undefined;
        const hasKeyLifts = !!protocol?.keyLifts.length;
        done({
          title: "Plan actualizado",
          description: hasNutrition
            ? priorities
              ? `${priorities} Nutrición recalculada con tu scan.`
              : "Rutina y nutrición recalculadas con tu scan."
            : priorities
              ?? (hasKeyLifts ? "Tus ejercicios clave ya están en la rutina." : "Tu nuevo entrenamiento ya está en tu cuenta."),
          tone: "ok",
        }, "Plan actualizado con tu scan");
        break;
      }
      case "nutrition_only":
        done({ title: "Plan actualizado", description: "Tu entrenamiento sigue igual; tus macros se han ajustado al scan.", tone: "ok" }, "Macros ajustados con tu scan");
        break;
      case "unchanged":
        done({ title: "Tu plan ya encajaba", description: "El plan ya reflejaba lo que propone el scan. No hacía falta cambiar nada.", tone: "ok" }, "Scan aplicado. Tu plan ya encajaba");
        break;
      case "unknown":
        done({ title: "No pudimos confirmarlo", description: "No sabemos si llegó a aplicarse. Revisa tu plan en unos minutos o reinténtalo.", tone: "warn" }, "No pudimos confirmar si se aplicó");
        break;
      case "sent_to_coach":
        setPlanApplyState("sent");
        toast.success("Scan guardado en tu historial");
        break;
      case "no_changes":
        setPlanApplyState("idle");
        toast.info("No hay nada nuevo que aplicar de este scan");
        break;
      case "needs_profile":
        setPlanApplyState("idle");
        toast.error("Te falta completar tu perfil para poder aplicar el scan. Complétalo en Ajustes.");
        break;
      case "session_expired":
        setPlanApplyState("idle");
        toast.error("Tu sesión ha caducado. Inicia sesión de nuevo para aplicar el scan.");
        await supabase.auth.signOut({ scope: "local" });
        navigate(`/login?next=${encodeURIComponent(scanBasePath)}`);
        break;
      case "custom_kept":
        setPlanApplyState("idle");
        toast.info("Hemos conservado tu rutina personalizada. El scan queda guardado.");
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

      const { error: insErr, data: scanRecord } = await supabase.from("scan_history").insert({
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
      }).select('id').single();
      if (insErr) console.warn("scan_history insert", insErr);
      
      const scanId = scanRecord?.id;

      // La foto frontal del scan también queda en «Físico» (diario de progreso).
      for (const [ph, label] of [[front, "Scan · frente"], [back, "Scan · espalda"]] as const) {
        if (!ph) continue;
        const { error: phErr } = await supabase.from("progress_photos").insert({
          user_id: user.id,
          photo_url: ph.path,
          note: label,
          taken_at: toLocalDateString(),
          scan_history_id: scanId ?? null,
        });
        if (phErr) console.warn("progress_photos insert", phErr);
      }

      const firstName = (userName || user.email?.split("@")[0] || "atleta").split(" ")[0];
      const cardImageUrl = await uploadScanCard(r);
      await supabase.functions.invoke("send-scan-diagnosis", {
        body: {
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
    applyRun.current += 1;
    lastApply.current = null;
    setPlanApplyState("idle");
    setPlanApplyCopy(null);
    // Un escaneo nuevo estrena id anónimo: el anterior ya no debe atribuirse a
    // quien escanee después en esta misma pestaña. También olvidamos el
    // informe anónimo que se hubiera restaurado.
    clearAnonScanId();
    clearPendingScanContext();
    setResult(null);
    setCurrentImg(null);
    setBackImg(null);
    setObjectiveImg(null);
    setScanStage("analyzing");
    setScanError(null);
    setPhase("upload");
    setGoal(null);
    setPendingResult(null);
    setLeadName("");
    setLeadWhatsapp("");
    setLeadEmail("");
    setLeadConsent(false);
  };

  const [resettingProgress, setResettingProgress] = useState(false);
  const { ask: confirmReset, dialog: resetDialog } = useConfirm();
  const resetProgress = async () => {
    if (!user || !routeUserId) return;
    const ok = await confirmReset({
      title: "¿Resetear tu progreso?",
      description: "Se borrarán todos tus scans anteriores y empezarás de cero. Esta acción no se puede deshacer.",
      confirmLabel: "Resetear",
    });
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
      // Las fotos de progreso que venían de estos scans ya no existen: quitar sus filas
      // para que Progreso → Físico no muestre tarjetas rotas.
      if (paths.length > 0) {
        const { error: photosError } = await supabase
          .from("progress_photos")
          .delete()
          .eq("user_id", user.id)
          .in("photo_url", paths);
        if (photosError) console.warn("No se pudieron limpiar las fotos de progreso", photosError);
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
  const scanBasePath = location.pathname + location.search;
  const signupWithPlan = (() => {
    if (user) return location.pathname + location.search;
    if (result) {
      const { rec } = recommendFor({
        bottleneck: result.bottleneck,
        improvements: result.improvements,
        monthsWithPlan: result.months_with_plan,
        plans,
      });
      if (rec.kind === "plan") return `${rec.to}&from=scan&next=${encodeURIComponent(scanBasePath)}`;
    }
    return `/signup?from=scan&next=${encodeURIComponent(scanBasePath)}`;
  })();
  const freeSignup = `/signup?from=scan&next=${encodeURIComponent(scanBasePath)}`;

  if (isUnauthorized || isAwaitingAuth) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-background px-6 text-center text-muted-foreground type-subhead">
        <Spinner size="md" />
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
        <StickyConversionBar onCta={() => navigate(freeSignup)} />
      )}
      {/* Barra de navegación: atrás en el leading; el título grande vive en el contenido */}
      {!embedded && (
        <NavBar
          solid={false}
          titleAsHeading={false}
          className="w-full px-2"
          leading={
            <>
              {user && <SidebarTrigger className="hidden md:inline-flex" />}
              <Link
                to={user ? "/dashboard" : "/"}
                onClick={() => void hapticTap()}
                className="inline-flex min-h-[44px] items-center pr-2 type-body text-primary transition-opacity active:opacity-60"
              >
                <ChevronLeft className="h-6 w-6 -ml-1" strokeWidth={2.5} aria-hidden="true" />
                Inicio
              </Link>
            </>
          }
        />
      )}

      <main className={cn("mx-auto w-full max-w-[680px]", embedded ? "pb-6" : "px-4 pb-24 pt-2")}>
        <AnimatePresence mode="wait">
          {!result && phase === "upload" ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex w-full flex-col gap-8"
            >
              <header>
                {!inline && (
                  <h1 data-nav-title className="type-large-title">Análisis físico con IA</h1>
                )}
                <p className="mt-1 type-subhead text-muted-foreground">
                  {routeUserId
                    ? "Sube tu foto de delante o de espalda para actualizar tu análisis."
                    : "Sube tus fotos y la IA analiza tu físico, tu potencial y por dónde empezar."}
                </p>
              </header>

              {user && routeUserId && !inline && <ScanProgressPanel userId={user.id} />}

              <div className="grid grid-cols-2 gap-3">
                <ScanPhotoTile
                  title="Foto de delante"
                  hint="Cuerpo completo"
                  badge="Recomendada"
                  image={currentImg}
                  onFile={(f) => void pickPhoto(f, setCurrentImg)}
                  onClear={() => setCurrentImg(null)}
                />
                <ScanPhotoTile
                  title="Foto de atrás"
                  hint="Cuerpo completo"
                  badge="Opcional"
                  image={backImg}
                  onFile={(f) => void pickPhoto(f, setBackImg)}
                  onClear={() => setBackImg(null)}
                />
              </div>

              {/* Físico objetivo: el guardado, la pregunta o la tira de referencias y foto propia */}
              {user && savedObjectiveUrl && !editingObjective ? (
                <section className="flex flex-col gap-2.5">
                  <h2 className="type-title3">Tu físico objetivo</h2>
                  <div className="flex items-center gap-4 rounded-card bg-card p-4">
                    <ScanImage src={savedObjectiveUrl} alt="Tu objetivo" className="h-[88px] w-[66px] shrink-0 rounded-chip" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate type-headline">
                        {goalPresets.find((p) => p.storage_path === savedObjectivePath || p.image_url === savedObjectiveUrl)?.name || goalLabel(savedGoalText) || "Tu objetivo actual"}
                      </p>
                      <p className="mt-0.5 type-footnote text-muted-foreground">La IA lo usará para estimar cuántos meses te faltan.</p>
                      <div className="-ml-3 mt-1 flex flex-wrap items-center">
                        <Button variant="plain" size="sm" onClick={() => { void hapticTap(); setEditingObjective(true); }}>
                          Cambiar objetivo
                        </Button>
                        <Button
                          variant="plain"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => {
                            void hapticTap();
                            setObjectiveImg(null);
                            setSelectedPresetId(null);
                            setEditingObjective(true);
                          }}
                        >
                          Quitar para este scan
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              ) : user && routeUserId && !savedObjectiveUrl && !editingObjective ? (
                <div className="flex items-center gap-3.5 rounded-card bg-card p-[18px]">
                  <IconTile icon={Target} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="type-headline">Tu objetivo</p>
                    <p className="truncate type-subhead text-muted-foreground">{goalLabel(savedGoalText) || "Sin definir"}</p>
                  </div>
                  <Button variant="plain" size="sm" className="-mr-2 shrink-0" onClick={() => { void hapticTap(); setEditingObjective(true); }}>
                    Cambiar
                  </Button>
                </div>
              ) : user && !savedObjectiveUrl && !editingObjective && hasObjectiveChoice === "unset" ? (
                <div className="flex items-start gap-3.5 rounded-card bg-card p-[18px]">
                  <IconTile icon={Target} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="type-headline">¿Tienes un físico objetivo?</p>
                    <p className="mt-0.5 type-subhead text-muted-foreground">Con un objetivo te calculamos cuántos meses tardarás en llegar.</p>
                    <div className="-ml-3 mt-1 flex flex-wrap items-center">
                      <Button variant="plain" size="sm" onClick={() => { void hapticTap(); setHasObjectiveChoice("yes"); setEditingObjective(true); }}>
                        Sí, elegir uno
                      </Button>
                      <Button variant="plain" size="sm" className="text-muted-foreground" onClick={() => { void hapticTap(); setHasObjectiveChoice("no"); }}>
                        Ahora no
                      </Button>
                    </div>
                  </div>
                </div>
              ) : user && !savedObjectiveUrl && !editingObjective && hasObjectiveChoice === "no" ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="type-subhead text-muted-foreground">El análisis se centra en tu físico actual.</p>
                  <Button variant="plain" size="sm" className="shrink-0" onClick={() => { void hapticTap(); setHasObjectiveChoice("yes"); setEditingObjective(true); }}>
                    Añadir objetivo
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <ScanObjectivePicker
                    presets={goalPresets.filter((p) => !!p.image_url)}
                    objective={objectiveImg}
                    presetId={selectedPresetId}
                    onPick={(f) => void pickObjective(f)}
                    onPreset={(p) => { setObjectiveImg(p.image_url); setSelectedPresetId(p.id); }}
                    onClear={() => { setObjectiveImg(null); setSelectedPresetId(null); }}
                  />
                  {savingCustomGoal && (
                    <p className="flex items-center gap-2 type-footnote text-muted-foreground"><Spinner size="sm" label="Guardando" />Guardando tu objetivo…</p>
                  )}
                  <p className="type-footnote text-muted-foreground">
                    {objectiveImg
                      ? "Objetivo elegido: la IA comparará tu físico con esta referencia y estimará cuántos meses te faltan."
                      : "Sin objetivo, el análisis se centra en tu físico actual, tus fortalezas y lo que más te conviene mejorar."}
                  </p>
                </div>
              )}

              <ScanTips />

              <div className="flex flex-col gap-3">
                {scanError && <ScanErrorNotice message={scanError} />}
                <Button
                  size="lg"
                  className="h-14 w-full"
                  onClick={() => { void hapticTap(); setPhase("analyzing"); }}
                  disabled={!currentImg && !backImg}
                >
                  Analizar mi físico
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>
                <p className="type-footnote text-muted-foreground">
                  Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos fotos el análisis es más completo.
                </p>
                <ScanPrivacyNote
                  text={user ? "Privado: solo para tu análisis · Menos de 1 minuto" : "Privado: solo para tu análisis · Sin registro · Menos de 1 minuto"}
                />
              </div>
            </motion.div>
          ) : !result && phase === "analyzing" ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <ScanAnalyzing photo={currentImg ?? backImg} stage={scanStage} navTitle={!inline} />
            </motion.div>
          ) : !result && phase === "lead" ? (
            <motion.div
              key="lead"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex w-full flex-col gap-6"
            >
              <header>
                <h1 data-nav-title={inline ? undefined : true} className="type-large-title">Tu diagnóstico está listo</h1>
                <p className="mt-1 type-subhead text-muted-foreground">Este es tu adelanto. Déjanos tu email para ver el diagnóstico completo.</p>
              </header>

              {pendingResult && (() => {
                const months = objectiveMonths(pendingResult);
                return (
                  <section className="rounded-sheet bg-card p-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <p className="type-footnote text-muted-foreground">Potencial</p>
                        <p className="mt-1 whitespace-nowrap">
                          <span className="type-figure text-[44px] leading-none text-primary">{scoreText(pendingResult.potential)}</span>
                          <span className="ml-1 type-subhead text-muted-foreground">/10</span>
                        </p>
                      </div>
                      {months && (
                        <div className="min-w-0">
                          <p className="type-footnote text-muted-foreground">Hasta tu físico objetivo</p>
                          <p className="mt-1 whitespace-nowrap">
                            <span className="type-figure text-[44px] leading-none">{groupedInt(months.withPlan)}</span>
                            <span className="ml-1.5 type-subhead text-muted-foreground">{months.withPlan === 1 ? "mes" : "meses"}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    {pendingResult.bottleneck && (
                      <div className="mt-4 sep-t pt-4">
                        <p className="type-footnote text-muted-foreground">Lo que más te frena</p>
                        <p className="mt-0.5 type-headline">{sentenceCase(pendingResult.bottleneck)}</p>
                      </div>
                    )}
                    <p className="mt-4 type-footnote text-muted-foreground">Estimación orientativa a partir de tus fotos.</p>
                  </section>
                );
              })()}

              <div className="flex flex-col gap-5">
                <div>
                  <label htmlFor="scan-lead-name" className="mb-1.5 block type-subhead text-muted-foreground">
                    Nombre
                  </label>
                  <input
                    id="scan-lead-name"
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    maxLength={100}
                    placeholder="Tu nombre"
                    className="field w-full" autoCapitalize="words" autoComplete="name" enterKeyHint="next"
                  />
                </div>
                <div>
                  <label htmlFor="scan-lead-email" className="mb-1.5 block type-subhead text-muted-foreground">
                    Email
                  </label>
                  <input
                    id="scan-lead-email"
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    maxLength={255}
                    placeholder="tu@email.com"
                    aria-describedby="scan-lead-email-hint"
                    className="field w-full" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" enterKeyHint="done"
                  />
                  <p id="scan-lead-email-hint" className="mt-1.5 type-footnote text-muted-foreground">
                    Te enviamos una copia aquí. Sin tarjeta y sin compromiso.
                  </p>
                </div>

                <div className="flex min-h-11 items-start gap-3 py-1">
                  <Checkbox
                    id="scan-lead-consent"
                    checked={leadConsent}
                    onCheckedChange={(v) => { void hapticSelection(); setLeadConsent(v === true); }}
                    className="-mt-0.5"
                  />
                  <label htmlFor="scan-lead-consent" className="select-none type-footnote text-muted-foreground">
                    Acepto que Autopilot use mi foto solo para generar mi diagnóstico físico, incluido su envío a los
                    proveedores de inteligencia artificial que lo analizan, y acepto la{" "}
                    <Link to="/legal/privacidad" className="text-primary">
                      política de privacidad
                    </Link>
                    .
                  </label>
                </div>

                <Button
                  size="lg"
                  onClick={() => { void hapticTap(); submitLead(); }}
                  disabled={submittingLead || !pendingResult}
                  className="w-full"
                >
                  {submittingLead ? (
                    <>
                      <Spinner size="sm" label="Enviando" className="text-primary-foreground" />
                      Enviando…
                    </>
                  ) : !pendingResult ? (
                    <>
                      <Spinner size="sm" label="Preparando tu diagnóstico" className="text-primary-foreground" />
                      Preparando tu diagnóstico…
                    </>
                  ) : (
                    "Ver mi diagnóstico ahora"
                  )}
                </Button>

                <ScanPrivacyNote text="Tu foto no se publica ni se comparte con otros usuarios. Se usa para tu análisis y puedes eliminarla cuando quieras." />
              </div>
            </motion.div>
          ) : result ? (
            <motion.div
              key="result"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="flex w-full flex-col gap-8"
            >
              <header>
                {inline ? (
                  <h2 className="type-title2">Tu análisis físico</h2>
                ) : (
                  <h1 data-nav-title className="type-large-title">Tu análisis físico</h1>
                )}
                <p className="mt-1 type-subhead text-muted-foreground">{result.basic ? "Scan básico · gratis" : "Análisis completo"}</p>
              </header>

              {/* El mismo resultado que la app y Progreso → Scan, en el mismo orden. */}
              <div className="flex flex-col gap-[18px]">
                <ScanResultView
                  result={result}
                  photo={currentImg ?? backImg}
                  objectivePhoto={objectiveImg}
                  onUpgrade={plans.plus ? () => navigate(user ? "/planes" : signupWithPlan) : undefined}
                />
                <ScanShareButton result={result} variant="secondary" />
                <p className="type-footnote text-muted-foreground">
                  Orientación visual aproximada. No sustituye una valoración profesional.
                </p>
              </div>

              {/* Aplicar al plan: la tarjeta y su estado */}
              {(user || routeUserId) && (
                <section aria-label="Tu plan">
                  {planApplyState === "idle" && (
                    <ScanApplyPlanCard
                      protocol={result.protocol}
                      priorities={scanPriorities(result)}
                      canApply={canApplyPlan}
                      hasChanges={hasScanInferences(result, scanOnboarding)}
                      canUpgrade={plans.plus}
                      plusName={plans.plusName}
                      onApply={() => applyScanToPlan(result)}
                      onUpgrade={() => navigate("/planes")}
                    />
                  )}
                  {planApplyState !== "idle" && (
                    <div className="rounded-card bg-card p-4">
                      {planApplyState === "applying" && (
                        <FindingRow
                          leading={<Spinner size="md" label="Aplicando" className="text-primary" />}
                          title="Aplicando el scan a tu plan…"
                          description="Recalculando entrenamiento y nutrición con los datos del scan."
                        />
                      )}
                      {planApplyState === "done" && planApplyCopy && (
                        <FindingRow
                          icon={planApplyCopy.tone === "warn" ? AlertTriangle : CheckCircle2}
                          iconClassName={planApplyCopy.tone === "warn" ? "text-muted-foreground" : "text-success"}
                          title={planApplyCopy.title}
                          description={planApplyCopy.description}
                          action={
                            <div className="flex items-center">
                              {planApplyCopy.tone === "warn" && (
                                <Button variant="plain" size="sm" onClick={() => { void hapticTap(); applyScanToPlan(result, true); }}>
                                  Reintentar
                                </Button>
                              )}
                              <Button variant="plain" size="sm" onClick={openPlan}>
                                Ver mi plan
                              </Button>
                            </div>
                          }
                        />
                      )}
                      {planApplyState === "sent" && (
                        <FindingRow
                          icon={CheckCircle2}
                          iconClassName="text-success"
                          title="Scan guardado"
                          description="Queda en tu historial con lo que propone para tu plan."
                        />
                      )}
                      {planApplyState === "error" && (
                        <FindingRow
                          icon={AlertTriangle}
                          iconClassName="text-destructive"
                          title="No se pudo aplicar al plan"
                          description="Tu plan sigue como estaba. Vuelve a intentarlo cuando quieras."
                          action={
                            <Button variant="plain" size="sm" onClick={() => { void hapticTap(); applyScanToPlan(result, true); }}>
                              Reintentar
                            </Button>
                          }
                        />
                      )}
                    </div>
                  )}
                </section>
              )}

              {user && routeUserId && !inline && <ScanProgressPanel userId={user.id} compact />}
              {user && routeUserId && !inline && !result.basic && typeof result.physique === "number" && (
                <BeforeAfterCompare userId={user.id} currentPhoto={currentImg} currentPhysique={result.physique} />
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

              {/* Yo futuro (Plus): la foto propia transformada con IA */}
              {!result.basic && simBase && (
                <section className="flex flex-col gap-2.5">
                  <h2 className="type-title3">
                    {result.months_with_plan ?? result.estimated_months
                      ? <>Tu yo en {monthsText(result.months_with_plan ?? result.estimated_months ?? 0)}</>
                      : <>Tu yo transformado</>}
                  </h2>
                  {currentImg && backImg && (
                    <Tabs value={simPose} onValueChange={(v) => { void hapticSelection(); setSimPose(v as "front" | "back"); }}>
                      <TabsList aria-label="Vista de la simulación" className="w-full max-w-xs">
                        <TabsTrigger value="front">Frente</TabsTrigger>
                        <TabsTrigger value="back">Espalda</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  <div className="relative aspect-[4/5] overflow-hidden rounded-sheet bg-card sm:aspect-[3/2]">
                    {futureImg ? (
                      <ScanImage src={futureImg} alt="Tu físico simulado con IA" className="h-full w-full" />
                    ) : (
                      <ScanImage
                        src={simBase}
                        alt=""
                        className="h-full w-full"
                        imgClassName="scale-110"
                        style={{
                          filter: isPaid && !genLoading
                            ? "brightness(1.05) contrast(1.05)"
                            : "blur(18px) brightness(1.1) contrast(1.1)",
                        }}
                      />
                    )}
                    {!futureImg && (
                      <>
                        <div className="absolute inset-0 bg-background/70" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                            {isPaid ? (
                              genLoading ? <Spinner size="lg" label="Generando" className="text-primary" /> : <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                            ) : (
                              <Lock className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                            )}
                          </span>
                          {isPaid ? (
                            <>
                              <p className="mt-3 max-w-xs type-footnote text-muted-foreground">
                                Tarda unos 15 s. Tu misma cara y tu físico transformado.
                              </p>
                              <Button
                                variant="tinted"
                                size="sm"
                                className="mt-3"
                                onClick={() => { void hapticTap(); generateFuture(); }}
                                disabled={genLoading}
                              >
                                {genLoading ? "Generando con IA…" : "Generar simulación con IA"}
                              </Button>
                            </>
                          ) : (
                            <>
                              <p className="mt-3 type-headline">Visualiza tu transformación</p>
                              <p className="mt-0.5 max-w-xs type-footnote text-muted-foreground">
                                Simulación generada con IA al activar tu plan
                              </p>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              )}

              {!isPaid && !user && (
                <LockedInsightsGrid
                  insights={result.locked_insights}
                  onCta={() => navigate(signupWithPlan)}
                />
              )}

              {/* Proyección + prueba social — antes del CTA final. El básico no la lleva: sin
                  objetivo ni protocolo serían meses inventados, y «tu yo futuro» es de Plus. */}
              {!isPaid && !user && !result.basic && typeof result.physique === "number" && (
                <ProjectionTimeline
                  currentScore={result.physique}
                  monthsWithPlan={result.months_with_plan ?? result.estimated_months ?? undefined}
                  monthsWithoutPlan={result.months_without_plan ?? undefined}
                  priorities={improvementList(result).slice(0, 3).map((i) => i.label)}
                  bottleneck={result.bottleneck ?? undefined}
                  onCta={() => navigate(signupWithPlan)}
                />
              )}
              {!isPaid && !user && <SocialProofStrip />}

              {/* Cierre: una sola acción dorada */}
              {!isPaid && !user ? (
                <section className="flex flex-col gap-3 pt-2">
                  <h2 className="type-title1">
                    {(() => {
                      const months = objectiveMonths(result);
                      // En positivo: los meses con plan (la comparación sin plan ya está en el resultado).
                      return months ? (
                        <>Llega ahí en <span className="whitespace-nowrap text-primary">{monthsText(months.withPlan)}</span></>
                      ) : (
                        <>Convierte el diagnóstico en <span className="text-primary">resultados reales</span></>
                      );
                    })()}
                  </h2>
                  <p className="type-subhead text-muted-foreground">
                    Crea tu cuenta gratis y Autopilot te monta una rutina para tu objetivo, tus días y tu material,
                    con este scan guardado para comparar el siguiente.
                  </p>
                  {/* Primero que la gente lo use: la acción principal es la cuenta gratis, no el pago. */}
                  <div className="mt-3 flex flex-col gap-2">
                    <Button size="lg" className="w-full" onClick={() => { void hapticTap(); navigate(freeSignup); }}>
                      Crear mi cuenta gratis
                    </Button>
                    {plans.plus && (
                      <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); navigate(signupWithPlan); }}>
                        Ver el scan completo con {plans.plusName}
                      </Button>
                    )}
                    <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); reset(); }}>
                      Hacer otro scan
                    </Button>
                  </div>
                  <p className="text-center type-footnote text-muted-foreground">Gratis · Sin tarjeta</p>
                </section>
              ) : (
                <section className="flex w-full flex-col gap-2">
                  {(user || routeUserId) && (
                    <>
                      <Button size="lg" className="w-full" onClick={startWorkoutFromScan}>
                        <Dumbbell aria-hidden="true" />
                        Comenzar entrenamiento de hoy
                      </Button>
                      <Button size="lg" variant="secondary" className="w-full" onClick={openPlan}>
                        Ver rutina semanal
                      </Button>
                    </>
                  )}
                  {!user && !routeUserId && (
                    <Button size="lg" className="w-full" onClick={() => { void hapticTap(); navigate(signupWithPlan); }}>
                      Empezar mi plan
                    </Button>
                  )}
                  <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); reset(); }}>
                    Hacer otro scan
                  </Button>
                  {user && (
                    <Button
                      variant="plain"
                      className="w-full text-destructive"
                      onClick={() => { void hapticTap(); resetProgress(); }}
                      disabled={resettingProgress}
                    >
                      {resettingProgress && <Spinner size="sm" label="Borrando" />}
                      Resetear progreso
                    </Button>
                  )}
                </section>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </>
  );

  if (inline) return <div className="relative w-full"><>{scanBody}{resetDialog}</></div>;

  if (embedded) {
    return (
      <MobileAppShell
        title={result ? "Tu análisis físico" : "Análisis físico con IA"}
        titleInContent
        active="progress"
        userId={user.id}
        onChange={openDashboard}
        onSettings={() => openDashboard("settings")}
      >
        <div className="relative w-full"><>{scanBody}{resetDialog}</></div>
      </MobileAppShell>
    );
  }

  return (
    <SidebarProvider>
    <div className="min-h-screen bg-background relative overflow-hidden flex w-full">
      {user && <UserSidebar section="progress" onNavigate={openDashboard} onSignOut={() => { void supabase.auth.signOut(); navigate("/"); }} />}
      <div className="flex-1 min-w-0 relative">
      <>{scanBody}{resetDialog}</>
      </div>
    </div>
    </SidebarProvider>
  );
};

export default Scan;
