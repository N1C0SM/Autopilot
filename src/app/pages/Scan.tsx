import { errorMessage, errorStatus, functionErrorMessage } from "@/shared/lib/runtimeValues";
import { formatDecimal } from "@/shared/lib/numberFormat";
import { compressImage, toBrowserFriendlyImage } from "@/shared/lib/imageCompression";
import { IconTile } from "@/shared/components/ui/icon-tile";
import React, { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import UserSidebar from "@/app/components/UserSidebar";
import MobileAppShell from "@/app/components/mobile/MobileAppShell";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { recordAcquisitionEvent } from "@/shared/lib/acquisition";
import {
  Upload,
  Sparkles,
  Check,
  CheckCircle2,
  ChevronLeft,
  TrendingUp,
  Target,
  X,
  Lock,
  AlertTriangle,
  Eye,
  Shield,
  Dumbbell,
  Flame,
  RefreshCw,
  Activity,
  Sprout,
  Ruler,
  ClipboardList,
  Share2,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { ListGroup, ListRow } from "@/shared/components/ui/list";
import NavBar from "@/shared/components/native/NavBar";
import { hapticTap, hapticSelection, shareFileOrImage } from "@/shared/lib/native";
import { supabase } from "@/shared/integrations/supabase/client";
import { applyScanPlan, canApplyScanToPlan, hasScanInferences, userSpecificGoal, type ScanApplyResult } from "@/shared/lib/scanApply";
import { toast } from "sonner";
import { useAuth } from "@/shared/contexts/AuthContext";
import poseFrontImg from "@/shared/assets/pose-front.png";
import poseBackImg from "@/shared/assets/pose-back.png";
import ProjectionTimeline from "@/app/components/scan/ProjectionTimeline";
import LockedInsightsGrid from "@/app/components/scan/LockedInsightsGrid";
import ScanPlusCard from "@/app/components/scan/ScanPlusCard";
import StickyConversionBar from "@/app/components/scan/StickyConversionBar";
import ScanCoverageCard from "@/app/components/scan/ScanCoverageCard";
import ScanShareCard from "@/app/components/scan/ScanShareCard";
import ScanRecommendations, { recommendFor } from "@/app/components/scan/ScanRecommendations";
import { usePlanAvailability } from "@/shared/lib/planCatalog";
import SocialProofStrip from "@/app/components/scan/SocialProofStrip";
import ScanProgressPanel from "@/app/components/scan/ScanProgressPanel";
import BeforeAfterCompare from "@/app/components/scan/BeforeAfterCompare";
import { FindingRow, MeterRow, ScanImage, StatRow, type Stat } from "@/app/components/scan/ScanResultParts";
import { signedUrlFor, signedUrlsFor } from "@/shared/lib/storageSign";
import { toLocalDateString } from "@/shared/lib/localDates";
import { clearAnonScanId, getOrCreateAnonScanId } from "@/shared/lib/scanAttribution";
import { useConfirm } from "@/app/components/admin/content/useConfirm";
import { clearPendingScanContext, markPendingScanRestored, readPendingScanContext } from "@/shared/lib/pendingScan";

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

// El objetivo se guarda por id ("gain_muscle"): en pantalla siempre su nombre.
const goalLabel = (value: string | null) => GOALS.find((goal) => goal.id === value)?.label ?? value;

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
          <ScanImage src={image} alt={label} className="w-full h-full" />
          <button
            onClick={() => { void hapticTap(); onClear(); }}
            aria-label="Quitar foto"
            className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center active:opacity-60"
          >
            <span className="w-8 h-8 rounded-full material flex items-center justify-center">
              <X className="w-4 h-4" strokeWidth={2.5} />
            </span>
          </button>
          <div className="absolute bottom-0 inset-x-0 material px-3 py-2.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
            <div className="type-subhead font-semibold truncate">
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

  const handleShare = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await renderScanCardDataUrl();
      if (!dataUrl) throw new Error("no card");

      // Liberar el botón antes de abrir el menú nativo (iOS puede no resolver nunca)
      setSharing(false);
      shareFileOrImage({
        dataUrl,
        filename: `autopilot-scan-${Date.now()}.png`,
        title: "Mi AI Physique Scan",
        text: "Mi físico analizado por IA en autopilotplan.com/scan",
      }).then((res) => {
        if (res.downloaded) toast.success("Tarjeta descargada");
      }).catch((e: unknown) => {
        console.error("[SCAN-SHARE]", e);
        toast.error("No se pudo compartir");
      });
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
    // Asegurar que TODAS las <img loading="eager" decoding="sync"> internas (foto del usuario, etc.) están decodificadas
    // antes de capturar — si no, html-to-image las pinta vacías.
    try {
      const imgs = Array.from(shareRef.current.querySelectorAll("img"));
      // En iOS las imágenes "lazy" fuera de pantalla nunca se cargan: forzamos carga inmediata.
      imgs.forEach((img) => { img.loading = "eager"; });
      await Promise.all(
        imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 4000);
          });
        })
      );
      await Promise.all(
        imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
      );
    } catch { /* Best-effort browser feature; the primary flow remains available. */ }
    try {
      // skipFonts: en la app de iPhone descargar fuentes externas bloquea la captura.
      const opts = { cacheBust: false, skipFonts: true, backgroundColor: "#070709" };
      await toPng(shareRef.current, { ...opts, pixelRatio: 1 }).catch(() => null);
      for (const ratio of [1, 0.85, 0.75]) {
        const url = await toPng(shareRef.current, { ...opts, pixelRatio: ratio });
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
      void recordAcquisitionEvent("scan");
      // Si está logueado saltamos el formulario de lead (ya tenemos su email)
      if (user && isPaid) {
        setTimeout(() => {
          setResult(r);
          // El plan NUNCA se toca solo: lo aplica el usuario con «Aplicar a mi plan».
          saveAndEmailScan(r, { silent: false });
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
      // El motivo del servidor solo elige el aviso (igual que en la app): nunca se enseña tal cual.
      const msg = await functionErrorMessage(e, errorMessage(e));
      if (status === 429 || /too many|429/i.test(msg)) {
        toast.error("Has hecho muchos análisis seguidos. Espera un rato y vuelve a intentarlo.");
      } else if (/payment/i.test(msg)) {
        toast.error("El análisis con IA está pausado: el servicio no tiene saldo. Estamos en ello; inténtalo más tarde.");
      } else if (!navigator.onLine) {
        toast.error("Sin conexión. Comprueba tu internet e inténtalo de nuevo.");
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
    if (result && canApplyPlan && hasScanInferences(result, scanOnboarding) && planApplyState === "idle") {
      void applyScanToPlan(result);
    }
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
      case "applied":
        done({ title: "Plan actualizado", description: priorityLine(res.priorities) ?? "Tu nuevo entrenamiento ya está en tu cuenta.", tone: "ok" }, "Plan actualizado con tu scan");
        break;
      case "nutrition_only":
        done({ title: "Plan actualizado", description: "Tu entrenamiento sigue igual; tus macros se han ajustado al scan.", tone: "ok" }, "Macros ajustados con tu scan");
        break;
      case "unchanged":
        done({ title: "Tu plan ya encajaba", description: "Hemos guardado lo que propone el scan para tus próximos ajustes.", tone: "ok" }, "Scan aplicado. Tu plan ya encajaba");
        break;
      case "unknown":
        done({ title: "No pudimos confirmarlo", description: "No sabemos si llegó a aplicarse. Revisa tu plan en unos minutos o reinténtalo.", tone: "warn" }, "No pudimos confirmar si se aplicó");
        break;
      case "sent_to_coach":
        setPlanApplyState("sent");
        toast.success("Guardado para tu entrenador");
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
      const cardImageUrl = await uploadScanCard();
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

      <main className={embedded ? "w-full pb-6" : "w-full px-4 pt-2 pb-24"}>
        <AnimatePresence mode="wait">
          {!result && phase === "upload" ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full space-y-10"
            >
              <header>
                {!inline && (
                  <h1 data-nav-title className="type-large-title mb-1">Análisis físico con IA</h1>
                )}
                <p className="type-subhead text-muted-foreground">
                  Sube tu foto frontal o de espalda para actualizar tu análisis
                </p>
              </header>

              {user && routeUserId && !inline && <ScanProgressPanel userId={user.id} />}

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
                  hint="Opcional"
                  image={backImg}
                  onFile={async (f) => setBackImg(await fileToDataUrl(f))}
                  onClear={() => setBackImg(null)}
                  placeholder={poseBackImg}
                />
              </div>

              {/* Físico objetivo: presets del admin + opción de subir foto propia */}
              {user && savedObjectiveUrl && !editingObjective ? (
                <div className="flex items-center gap-4">
                  <ScanImage
                    src={savedObjectiveUrl}
                    alt="Tu objetivo"
                    className="h-24 w-20 shrink-0 rounded-[10px]"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="type-headline truncate">
                      {goalPresets.find((p) => p.storage_path === savedObjectivePath || p.image_url === savedObjectiveUrl)?.name || goalLabel(savedGoalText) || "Tu objetivo actual"}
                    </h2>
                    <p className="type-subhead text-muted-foreground mt-0.5">
                      La IA lo usará para estimar cuántos meses te faltan.
                    </p>
                    <div className="flex flex-wrap items-center mt-1 -ml-3">
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() => { void hapticTap(); setEditingObjective(true); }}
                      >
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
              ) : user && routeUserId && !savedObjectiveUrl && !editingObjective ? (
                <div className="rounded-2xl bg-card p-4">
                <FindingRow
                  icon={Target}
                  title="Tu objetivo"
                  description={<span className="block truncate">{goalLabel(savedGoalText) || "Sin objetivo definido"}</span>}
                  action={
                    <Button variant="plain" size="sm" onClick={() => { void hapticTap(); setEditingObjective(true); }}>
                      Cambiar objetivo
                    </Button>
                  }
                />
                </div>
              ) : user && !savedObjectiveUrl && !editingObjective && hasObjectiveChoice === "unset" ? (
                <FindingRow
                  icon={Target}
                  title="¿Tienes un físico objetivo?"
                  description="Solo si pones un objetivo te calculamos cuántos meses tardarás en llegar."
                  action={
                    <div className="flex flex-wrap items-center">
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
                  }
                />
              ) : user && !savedObjectiveUrl && !editingObjective && hasObjectiveChoice === "no" ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="type-subhead text-muted-foreground">
                    Sin objetivo · el análisis se centra en tu físico actual.
                  </p>
                  <Button variant="plain" size="sm" className="shrink-0" onClick={() => { void hapticTap(); setHasObjectiveChoice("yes"); setEditingObjective(true); }}>
                    Añadir objetivo
                  </Button>
                </div>
              ) : (
              <div>
                <FindingRow
                  icon={Target}
                  title="Tu físico objetivo"
                  description="Elige una referencia o sube tu foto. Solo con objetivo calculamos cuántos meses te faltan."
                  action={
                    objectiveImg ? (
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() => { void hapticTap(); setObjectiveImg(null); setSelectedPresetId(null); }}
                      >
                        Quitar
                      </Button>
                    ) : undefined
                  }
                />

                {/* Un objetivo sin foto es una caja vacía con un nombre: no aporta nada */}
                {goalPresets.some((p) => p.image_url) && (
                  <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
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
                          className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-card transition-transform duration-150 active:scale-[0.97] ${
                            isSel ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                          }`}
                        >
                          <ScanImage src={p.image_url} alt={p.name} className="h-full w-full" />
                          <div className="absolute inset-x-0 bottom-0 material p-2">
                            <div className="line-clamp-2 type-caption1 font-semibold">
                              {p.name}
                            </div>
                          </div>
                          {isSel && (
                            <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <label className="mt-4 block cursor-pointer">
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
                    <ScanImage
                      src={objectiveImg}
                      alt="tu objetivo"
                      className="aspect-[3/4] w-28 rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background"
                    />
                  ) : (
                    <div className="flex min-h-[72px] items-center gap-4 rounded-2xl bg-card px-4 py-3 transition-colors active:bg-accent">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[22%] bg-secondary">
                        <Upload className="h-6 w-6 text-primary" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <div className="type-headline">O sube tu propia foto</div>
                        <div className="type-subhead text-muted-foreground">JPG / PNG</div>
                      </div>
                    </div>
                  )}
                </label>
                <p className="mt-3 type-footnote text-muted-foreground">
                  {objectiveImg
                    ? "Objetivo seleccionado. La IA comparará tu físico con esta referencia y estimará cuántos meses te faltan."
                    : "Sin objetivo el análisis se centra en tu físico actual, fortalezas y mejoras prioritarias — sin estimación de tiempo."}
                </p>
              </div>
              )}

              {/* Guía para tomar las fotos */}
              <section>
                <h2 className="type-title3 mb-3">Cómo tomar las fotos</h2>
                <div className="space-y-5 rounded-2xl bg-card p-4">
                  <FindingRow
                    icon={Ruler}
                    title="Distancia"
                    description="Cámara a 2-3 m, a la altura del ombligo, con el cuerpo entero y el móvil en vertical y bien apoyado."
                  />
                  <FindingRow
                    icon={Eye}
                    title="Luz y fondo"
                    description="Luz natural frontal y uniforme, sin contraluz ni flash, con un fondo liso y claro."
                  />
                  <FindingRow
                    icon={Activity}
                    title="Postura y ropa"
                    description="Ropa ajustada, pies a la anchura de los hombros y brazos relajados a los lados. Para la de atrás, date la vuelta sin moverte de sitio."
                  />
                </div>
              </section>

              <div className="mx-auto w-full max-w-sm space-y-3">
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <div className="text-center mb-8">
                <div className="mx-auto w-[72px] h-[72px] rounded-[22%] bg-card flex items-center justify-center mb-5">
                  <Target className="w-8 h-8 text-primary" strokeWidth={1.75} />
                </div>
                <p className="type-subhead text-muted-foreground mb-1">Paso 2 · Tu objetivo</p>
                <h1 data-nav-title={inline ? undefined : true} className="type-title1">
                  ¿Cuál es tu <span className="text-primary">objetivo principal</span>?
                </h1>
                <p className="type-subhead text-muted-foreground mt-2">
                  La IA prioriza tu diagnóstico en función de lo que más te importa.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl bg-card">
                {GOALS.map((g) => {
                  const Icon = g.icon;
                  const active = goal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { void hapticSelection(); setGoal(g.id); }}
                      aria-pressed={active}
                      className="group/row flex w-full items-center gap-3 px-4 text-left transition-colors duration-150 active:bg-accent"
                    >
                      <IconTile icon={Icon} />
                      <span className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 group-[:not(:last-child)]/row:sep-b">
                        <span className="min-w-0 flex-1">
                          <span className="block type-body">{g.label}</span>
                          <span className="mt-0.5 block type-footnote text-muted-foreground">{g.desc}</span>
                        </span>
                        {active && <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mx-auto mt-8 w-full max-w-sm space-y-2">
                <Button
                  size="lg"
                  disabled={!goal}
                  onClick={() => { void hapticTap(); setPhase("analyzing"); }}
                  className="w-full"
                >
                  Analizar mi físico
                </Button>
                <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); setPhase("upload"); }}>
                  Volver
                </Button>
              </div>
            </motion.div>
          ) : !result && phase === "analyzing" ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center py-12 text-center"
            >
              <ProgressRing value={scanProgress} size={160} stroke={12} className="mb-8" label="Progreso del análisis">
                <span className="type-figure text-[34px] font-bold leading-none tabular-nums">
                  {Math.round(scanProgress)}
                  <span className="type-headline text-muted-foreground">%</span>
                </span>
              </ProgressRing>
              <h2 data-nav-title={inline ? undefined : true} className="type-title1">
                Analizando tu físico
              </h2>
              <AnimatePresence mode="wait">
                <motion.div
                  key={loadingMsgIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 flex items-center justify-center gap-2 type-callout text-muted-foreground"
                >
                  <Spinner size="sm" />
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ) : !result && phase === "lead" ? (
            <motion.div
              key="lead"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mx-auto w-full max-w-md"
            >
              <div className="text-center mb-8">
                <div className="mx-auto w-[72px] h-[72px] rounded-[22%] bg-card flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-8 h-8 text-success" strokeWidth={1.75} />
                </div>
                <p className="type-subhead text-muted-foreground mb-1">Diagnóstico listo</p>
                <h1 className="type-title1 mb-3">
                  Hemos detectado tus <span className="text-primary">principales prioridades físicas</span>.
                </h1>
                <p className="type-subhead text-muted-foreground">
                  Dinos tu nombre y tu email y te lo mostramos ahora mismo. También te lo
                  enviamos por correo para que lo tengas guardado.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="scan-lead-name" className="type-subhead text-muted-foreground mb-1.5 block">
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
                  <label htmlFor="scan-lead-email" className="type-subhead text-muted-foreground mb-1.5 block">
                    Email
                  </label>
                  <input
                    id="scan-lead-email"
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    maxLength={255}
                    placeholder="tu@email.com"
                    className="field w-full" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" enterKeyHint="done"
                  />
                  <p className="type-footnote text-muted-foreground mt-1.5">
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
                      <Spinner />
                      Enviando…
                    </>
                  ) : !pendingResult ? (
                    <>
                      <Spinner />
                      Generando tu diagnóstico…
                    </>
                  ) : (
                    <>
                      Ver mi diagnóstico ahora
                    </>
                  )}
                </Button>

                <div className="flex items-start gap-2 pt-1">
                  <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full space-y-10"
            >
              {/* Protagonista: la puntuación de físico en un anillo, como Actividad */}
              <section>
                {inline ? (
                  <h2 className="type-title2">Tu análisis físico</h2>
                ) : (
                  <h1 data-nav-title className="type-large-title">Tu análisis físico</h1>
                )}
                {result.basic ? (
                  <p className="mt-1 type-subhead text-muted-foreground">Scan básico · gratis</p>
                ) : (
                  <p className="mt-1 flex items-center gap-1.5 type-subhead text-success">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Análisis completo
                  </p>
                )}

                <div className="mt-8 flex flex-col items-center text-center">
                  <ProgressRing value={result.physique * 10} size={200} stroke={14} label="Puntuación de físico">
                    <div className="flex flex-col items-center">
                      <span className="type-figure text-[56px] font-bold leading-none tabular-nums min-[390px]:text-[64px]">
                        {formatDecimal(result.physique, 1)}
                      </span>
                      <span className="mt-1.5 type-footnote text-muted-foreground">Físico · de 10</span>
                    </div>
                  </ProgressRing>
                  {result.headline_diagnosis ? (
                    <p className="mt-6 max-w-md type-title3">"{result.headline_diagnosis}"</p>
                  ) : (
                    <p className="mt-6 max-w-md type-body text-muted-foreground">{result.summary}</p>
                  )}
                </div>

                {(() => {
                  const hasObjective = !!objectiveImg || !!savedObjectiveUrl;
                  const showMonths = hasObjective && result.months_with_plan !== undefined;
                  const stats: Stat[] = [
                    { label: "Atractivo", value: formatDecimal(result.attractiveness, 1), unit: "/10" },
                    { label: "Potencial", value: formatDecimal(result.potential, 1), unit: "/10", tone: "text-primary" },
                    { label: "Estilo", value: formatDecimal(result.style, 1), unit: "/10" },
                  ];
                  if (showMonths) {
                    stats.push({ label: "A tu objetivo", value: Math.max(1, result.months_with_plan!), unit: "meses" });
                  }
                  return (
                    <>
                      <StatRow stats={stats} className="mt-8" />
                      {showMonths && result.months_without_plan !== undefined && (
                        <p className="mt-2 type-footnote text-muted-foreground tabular-nums">
                          Con plan, frente a unos {Math.max(2, result.months_without_plan)} meses sin plan.
                        </p>
                      )}
                    </>
                  );
                })()}
                <p className="mt-2 type-footnote text-muted-foreground">
                  Orientación visual aproximada. No sustituye una valoración profesional.
                </p>

                <div className="mt-6 overflow-hidden rounded-[22px] bg-card p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" aria-hidden="true" />
                        <h4 className="type-headline font-semibold text-foreground">Comparte tu diagnóstico</h4>
                      </div>
                      <p className="mt-1 type-footnote text-muted-foreground">
                        Genera una Story para Instagram con tu análisis, fotos y objetivos.
                      </p>
                    </div>
                    <Button
                      variant="hero"
                      size="default"
                      className="shrink-0 shadow-sm"
                      onClick={() => { void hapticTap(); void handleShare(); }}
                      disabled={sharing}
                    >
                      {sharing ? <Spinner size="sm" /> : <Share2 className="size-4" aria-hidden="true" />}
                      Compartir en Stories
                    </Button>
                  </div>
                </div>
              </section>

              {/* Estado de aplicación al plan: patrón de la bienvenida, sin caja */}
              {(user || routeUserId) && (
                <section aria-label="Tu plan">
                  {planApplyState === "idle" && (
                    <FindingRow
                      icon={ClipboardList}
                      title="Tu plan sigue igual"
                      description="El scan no cambia nada por sí solo. Aplícalo solo si te encaja."
                      action={
                        !hasScanInferences(result, scanOnboarding) ? (
                          <p className="pl-3 type-footnote text-muted-foreground">
                            Este scan no propone cambios, así que no hay nada que aplicar.
                          </p>
                        ) : canApplyPlan ? (
                          <Button variant="plain" size="sm" onClick={() => { void hapticTap(); applyScanToPlan(result); }}>
                            Aplicar a mi plan
                          </Button>
                        ) : (
                          <p className="pl-3 type-footnote text-muted-foreground">
                            {plans.plus
                              ? "Ajustar tu plan con cada scan es parte de Plus."
                              : "Tu plan gratuito mantiene su rutina inicial."}
                          </p>
                        )
                      }
                    />
                  )}
                  {planApplyState === "applying" && (
                    <FindingRow
                      leading={<Spinner size="md" />}
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
                      title="Guardado para tu entrenador"
                      description="Verá en tu ficha lo que propone el scan cuando ajuste tu plan."
                    />
                  )}
                  {planApplyState === "error" && (
                    <FindingRow
                      icon={AlertTriangle}
                      iconClassName="text-destructive"
                      title="No se pudo aplicar al plan"
                      description="Tu plan no ha cambiado. Vuelve a intentarlo cuando quieras."
                      action={
                        <Button variant="plain" size="sm" onClick={() => { void hapticTap(); applyScanToPlan(result, true); }}>
                          Reintentar
                        </Button>
                      }
                    />
                  )}
                </section>
              )}

              {user && routeUserId && !inline && <ScanProgressPanel userId={user.id} compact />}
              {user && routeUserId && !inline && !result.basic && (
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

              {/* Hallazgos: icono + título + descripción, como la lista de la bienvenida */}
              {(result.bottleneck || (result.improvements?.length ?? 0) > 0) && (
                <section>
                  <h2 className="type-title2">Diagnóstico</h2>
                  <div className="mt-5 space-y-6">
                    {result.bottleneck && (
                      <FindingRow icon={AlertTriangle} title="Lo que más te frena" description={result.bottleneck} />
                    )}
                    {(result.improvements ?? []).filter((m) => m.label.trim() !== result.bottleneck?.trim()).map((m, i) => (
                      <FindingRow
                        key={i}
                        icon={TrendingUp}
                        iconClassName={m.priority === "Alta" ? "text-primary" : "text-muted-foreground"}
                        title={m.label}
                        description={m.priority ? `Prioridad ${String(m.priority).toLowerCase()}` : undefined}
                      />
                    ))}
                  </div>
                </section>
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

              {/* Fotos y similitud al objetivo */}
              {(() => {
                const shots: { src: string; label: string; primary?: boolean }[] = [];
                if (currentImg) shots.push({ src: currentImg, label: "Actual" });
                if (objectiveImg) shots.push({ src: objectiveImg, label: "Objetivo", primary: true });
                else if (backImg) shots.push({ src: backImg, label: "Espalda" });
                if (shots.length === 0 && !objectiveImg) return null;
                return (
                  <section>
                    <h2 className="type-title2">Tus fotos</h2>
                    <div className={`mt-4 grid gap-3 ${shots.length > 1 ? "grid-cols-2" : "grid-cols-1 max-w-[240px]"}`}>
                      {shots.map((p) => (
                        <figure key={p.label} className="min-w-0">
                          <ScanImage src={p.src} alt={p.label.toLowerCase()} className="aspect-[3/4] w-full rounded-2xl" />
                          <figcaption className={`mt-2 type-subhead ${p.primary ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                            {p.label}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                    {objectiveImg && (
                      <div className="mt-4">
                        <MeterRow
                          label="Similitud al objetivo"
                          value={`${result.similarity}%`}
                          pct={result.similarity}
                          hint={
                            <>
                              Tiempo estimado:{" "}
                              <span className="font-semibold text-foreground tabular-nums">
                                ~{result.estimated_months ?? result.months_with_plan ?? "—"} meses
                              </span>{" "}
                              con plan personalizado y constancia.
                            </>
                          }
                        />
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* Scan básico: lo de Plus en una tarjeta, en lugar del yo futuro y el detalle */}
              {result.basic && (
                <ScanPlusCard sections={result.locked_sections} onUpgrade={() => navigate(user ? "/planes" : signupWithPlan)} />
              )}

              {/* Yo futuro: contenido rico, una sola superficie */}
              {!result.basic && (
              <section>
                <h2 className="type-title2">
                  {result.months_with_plan ?? result.estimated_months
                    ? <>Tu yo en {result.months_with_plan ?? result.estimated_months} meses</>
                    : <>Tu yo transformado</>}
                </h2>
                {currentImg && backImg && (
                  <Tabs
                    value={simPose}
                    onValueChange={(v) => { void hapticSelection(); setSimPose(v as "front" | "back"); }}
                    className="mt-4"
                  >
                    <TabsList aria-label="Vista de la simulación" className="w-full max-w-xs">
                      <TabsTrigger value="front">Frente</TabsTrigger>
                      <TabsTrigger value="back">Espalda</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
                <div className="relative mt-4 aspect-[3/2] overflow-hidden rounded-2xl bg-card">
                  {futureImg ? (
                    <ScanImage src={futureImg} alt="futuro IA" className="h-full w-full" />
                  ) : simBase ? (
                    <ScanImage
                      src={simBase}
                      alt="futuro"
                      className="w-full h-full"
                      imgClassName="scale-110"
                      style={{
                        filter: isPaid && !genLoading
                          ? "brightness(1.05) contrast(1.05)"
                          : "blur(18px) brightness(1.1) contrast(1.1)",
                      }}
                    />
                  ) : null}
                  {!futureImg && (
                    <>
                      <div className="absolute inset-0 bg-background/70" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[22%] bg-card">
                          {isPaid ? (
                            genLoading ? <Spinner /> : <Sparkles className="h-7 w-7 text-primary" strokeWidth={1.75} />
                          ) : (
                            <Lock className="h-7 w-7 text-primary" strokeWidth={1.75} />
                          )}
                        </div>
                        {isPaid ? (
                          <>
                            <p className="mt-3 max-w-xs type-footnote text-muted-foreground">
                              Tarda ~15s. Misma identidad, físico transformado.
                            </p>
                            <Button
                              variant="tinted"
                              size="sm"
                              className="mt-3"
                              onClick={() => { void hapticTap(); generateFuture(); }}
                              disabled={genLoading}
                            >
                              {genLoading ? "Generando con IA…" : "Generar simulación IA"}
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

              {/* === CAPA DE DETALLE — lectura estimada por IA === */}
              {(result.body_composition || result.muscle_breakdown?.length || result.posture || result.proportions || result.genetic_markers?.length || result.protocol) && (
                <section className="space-y-10">
                  <header>
                    <h2 className="type-title2">Lectura estimada por IA</h2>
                    <p className="mt-1 type-subhead text-muted-foreground">
                      Lectura por grupo muscular, composición, postura, proporciones y protocolo accionable a partir de tus
                      fotos. Es una estimación visual, no un diagnóstico médico.
                    </p>
                  </header>

                  {/* Composición corporal */}
                  {result.body_composition && (() => {
                    const bc = result.body_composition;
                    const stats: Stat[] = [];
                    if (bc.body_fat_pct !== undefined) stats.push({ label: "Grasa", value: bc.body_fat_pct, unit: "%", tone: "text-primary" });
                    if (bc.lean_mass_kg !== undefined) stats.push({ label: "Masa magra", value: bc.lean_mass_kg, unit: "kg" });
                    if (bc.weight_kg !== undefined) stats.push({ label: "Peso est.", value: bc.weight_kg, unit: "kg" });
                    return (
                      <div>
                        <h3 className="type-title3">Composición corporal estimada</h3>
                        <StatRow stats={stats} className="mt-2" />
                        {(bc.somatotype || bc.frame_size || bc.fat_distribution) && (
                          <ListGroup className="mt-4">
                            {bc.somatotype && <ListRow title="Somatotipo" value={sentenceCase(bc.somatotype)} />}
                            {bc.frame_size && <ListRow title="Estructura" value={sentenceCase(bc.frame_size)} />}
                            {bc.fat_distribution && (
                              <ListRow title="Distribución de grasa" subtitle={sentenceCase(bc.fat_distribution)} />
                            )}
                          </ListGroup>
                        )}
                      </div>
                    );
                  })()}

                  {/* Proporciones */}
                  {result.proportions && (
                    <div>
                      <h3 className="type-title3">Proporciones y simetría</h3>
                      <div className="mt-1">
                        {result.proportions.shoulder_to_waist_ratio !== undefined && (
                          <MeterRow
                            label="Ratio hombro/cintura"
                            value={formatDecimal(result.proportions.shoulder_to_waist_ratio, 2)}
                            hint="Ideal ~1.60"
                            pct={(result.proportions.shoulder_to_waist_ratio / 1.8) * 100}
                          />
                        )}
                        {result.proportions.v_taper_score !== undefined && (
                          <MeterRow
                            label="V-taper"
                            value={`${result.proportions.v_taper_score}/10`}
                            pct={result.proportions.v_taper_score * 10}
                          />
                        )}
                        {result.proportions.symmetry_score !== undefined && (
                          <MeterRow
                            label="Simetría"
                            value={`${result.proportions.symmetry_score}/10`}
                            pct={result.proportions.symmetry_score * 10}
                          />
                        )}
                      </div>
                      {(result.proportions.upper_lower_balance || result.proportions.weakest_link) && (
                        <div className="mt-5 space-y-6">
                          {result.proportions.upper_lower_balance && (
                            <FindingRow
                              icon={Ruler}
                              iconClassName="text-muted-foreground"
                              title="Balance"
                              description={result.proportions.upper_lower_balance}
                            />
                          )}
                          {result.proportions.weakest_link && (
                            <FindingRow icon={Target} title="Eslabón más débil" description={result.proportions.weakest_link} />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Breakdown por grupo muscular */}
                  {result.muscle_breakdown && result.muscle_breakdown.length > 0 && (
                    <div>
                      <h3 className="type-title3">Lectura por grupo muscular</h3>
                      <div className="mt-1 grid md:grid-cols-2 md:gap-x-8">
                        {result.muscle_breakdown.map((m, i) => (
                          <MeterRow
                            key={i}
                            label={m.group}
                            value={
                              <span className={m.score >= 7 ? "text-primary" : m.score >= 5 ? "text-foreground" : "text-muted-foreground"}>
                                {formatDecimal(m.score, 1)}
                                <span className="type-footnote font-normal text-muted-foreground">/10</span>
                              </span>
                            }
                            pct={m.score * 10}
                            dim={m.score < 7}
                            hint={m.verdict}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Postura */}
                  {result.posture && (result.posture.issues?.length || result.posture.note) && (
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="type-title3">Postura</h3>
                        {result.posture.severity && (
                          <span className={`type-subhead font-semibold ${
                            result.posture.severity === "severa" ? "text-destructive" :
                            result.posture.severity === "moderada" ? "text-primary" :
                            "text-muted-foreground"
                          }`}>{sentenceCase(result.posture.severity)}</span>
                        )}
                      </div>
                      {result.posture.issues && result.posture.issues.length > 0 && (
                        <ul className="mt-1">
                          {result.posture.issues.map((iss, i) => (
                            <li key={i} className="sep-b last:border-b-0 py-3 type-body">{iss}</li>
                          ))}
                        </ul>
                      )}
                      {result.posture.note && (
                        <p className="mt-2 type-footnote text-muted-foreground">{result.posture.note}</p>
                      )}
                    </div>
                  )}

                  {/* Marcadores visuales (no genéticos) */}
                  {result.genetic_markers && result.genetic_markers.length > 0 && (
                    <div>
                      <h3 className="type-title3">Rasgos visuales que juegan a tu favor (o en contra)</h3>
                      <ul className="mt-1">
                        {result.genetic_markers.map((g, i) => (
                          <li key={i} className="sep-b last:border-b-0 py-3 type-body">{g}</li>
                        ))}
                      </ul>
                      <p className="mt-2 type-footnote text-muted-foreground">
                        Señales observadas en tus fotos: no es un estudio genético.
                      </p>
                    </div>
                  )}

                  {/* Protocolo accionable */}
                  {result.protocol && (
                    <div>
                      <h3 className="type-title3">Protocolo recomendado por la IA</h3>
                      {(result.protocol.training_days_per_week !== undefined ||
                        result.protocol.weekly_sets_priority !== undefined ||
                        result.protocol.protein_g_per_kg !== undefined ||
                        result.protocol.calorie_adjustment_kcal !== undefined ||
                        result.protocol.cardio_minutes_per_week !== undefined) && (
                        <ListGroup className="mt-3">
                          {result.protocol.training_days_per_week !== undefined && (
                            <ListRow title="Días de entreno por semana" value={<span className="tabular-nums">{result.protocol.training_days_per_week}</span>} />
                          )}
                          {result.protocol.weekly_sets_priority !== undefined && (
                            <ListRow title="Series del grupo prioritario" value={<span className="tabular-nums">{result.protocol.weekly_sets_priority}</span>} />
                          )}
                          {result.protocol.protein_g_per_kg !== undefined && (
                            <ListRow title="Proteína por kg" value={<span className="tabular-nums">{result.protocol.protein_g_per_kg} g</span>} />
                          )}
                          {result.protocol.calorie_adjustment_kcal !== undefined && (
                            <ListRow
                              title="Calorías frente a mantenimiento"
                              value={
                                <span className="tabular-nums">
                                  {result.protocol.calorie_adjustment_kcal > 0 ? "+" : ""}{result.protocol.calorie_adjustment_kcal} kcal
                                </span>
                              }
                            />
                          )}
                          {result.protocol.cardio_minutes_per_week !== undefined && (
                            <ListRow title="Cardio por semana" value={<span className="tabular-nums">{result.protocol.cardio_minutes_per_week} min</span>} />
                          )}
                        </ListGroup>
                      )}
                      {result.protocol.key_lifts && result.protocol.key_lifts.length > 0 && (
                        <div className="mt-6">
                          <h4 className="type-headline">Ejercicios clave</h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {result.protocol.key_lifts.map((l, i) => (
                              <span key={i} className="rounded-full bg-secondary px-3 py-1.5 type-subhead">
                                {l}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.protocol.avoid && result.protocol.avoid.length > 0 && (
                        <div className="mt-6">
                          <h4 className="type-headline">Evita</h4>
                          <ul className="mt-1">
                            {result.protocol.avoid.map((a, i) => (
                              <li key={i} className="flex items-start gap-3 py-2 type-subhead text-muted-foreground">
                                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Proyección + prueba social — antes del CTA final. El básico no la lleva: sin
                  objetivo ni protocolo serían meses inventados, y «tu yo futuro» es de Plus. */}
              {!isPaid && !user && !result.basic && (
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

              {/* FUNNEL CTA — cierre al estilo de la bienvenida: una sola acción dorada */}
              {!isPaid && !user ? (
                <section className="pt-4 text-center">
                  <h2 className="type-title1">
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
                  </h2>
                  <p className="mx-auto mt-3 max-w-md type-subhead text-muted-foreground">
                    Crea tu cuenta gratis y Autopilot te monta una rutina para tu objetivo, tus días y tu material,
                    con este scan guardado para comparar el siguiente.
                  </p>
                  {/* Primero que la gente lo use: la acción principal es la cuenta gratis, no el pago. */}
                  <div className="mx-auto mt-6 max-w-sm space-y-2">
                    <Button size="lg" className="w-full" onClick={() => { void hapticTap(); navigate(freeSignup); }}>
                      Crear mi cuenta gratis
                    </Button>
                    {(plans.plus || plans.coach) && (
                      <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); navigate(signupWithPlan); }}>
                        Ver el scan completo con {plans.plus ? plans.plusName : plans.coachName}
                      </Button>
                    )}
                    <Button variant="plain" className="w-full" onClick={() => { void hapticTap(); reset(); }}>
                      Hacer otro scan
                    </Button>
                  </div>
                  <p className="mt-3 type-footnote text-muted-foreground">Gratis · Sin tarjeta</p>
                </section>
              ) : (
                <section className="mx-auto w-full max-w-sm space-y-2">
                  {(user || routeUserId) && (
                    <>
                      <Button size="lg" variant="hero" className="w-full gap-2 shadow-sm" onClick={startWorkoutFromScan}>
                        <Dumbbell className="h-4 w-4" aria-hidden="true" />
                        Comenzar entrenamiento de hoy
                      </Button>
                      <Button size="lg" variant="secondary" className="w-full" onClick={openPlan}>
                        Ver rutina semanal
                      </Button>
                    </>
                  )}
                  {user && canApplyPlan && hasScanInferences(result, scanOnboarding) && (planApplyState === "idle" || planApplyState === "error") && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full"
                      onClick={() => { void hapticTap(); applyScanToPlan(result, planApplyState === "error"); }}
                    >
                      {planApplyState === "error" ? "Reintentar aplicar a mi plan" : "Aplicar a mi plan"}
                    </Button>
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
                      {resettingProgress && <Spinner size="sm" />}
                      Resetear progreso
                    </Button>
                  )}
                </section>
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
                <ScanShareCard ref={shareRef} result={result} photos={[currentImg, backImg].filter(Boolean) as string[]} />
              </div>
            </motion.div>
          )}
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
        onChange={(t) => { try { sessionStorage.setItem("autopilot_section", t); } catch { /* sin storage */ } navigate("/dashboard"); }}
        onSettings={() => { try { sessionStorage.setItem("autopilot_section", "settings"); } catch { /* sin storage */ } navigate("/dashboard"); }}
      >
        <div className="relative w-full"><>{scanBody}{resetDialog}</></div>
      </MobileAppShell>
    );
  }

  return (
    <SidebarProvider>
    <div className="min-h-screen bg-background relative overflow-hidden flex w-full">
      {user && <UserSidebar section="progress" onNavigate={(s) => navigate(s === "progress" ? `/scan/user/${user.id}` : "/dashboard")} onSignOut={() => { void supabase.auth.signOut(); navigate("/"); }} />}
      <div className="flex-1 min-w-0 relative">
      <>{scanBody}{resetDialog}</>
      </div>
    </div>
    </SidebarProvider>
  );
};

export default Scan;
