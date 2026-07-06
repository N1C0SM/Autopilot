import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfile from "./tools/get-profile";
import getTrainingPlan from "./tools/get-training-plan";
import getNutritionPlan from "./tools/get-nutrition-plan";
import listWeightLogs from "./tools/list-weight-logs";
import logWeight from "./tools/log-weight";

// Direct Supabase host issuer required by mcp-js. Build from the project ref
// literal (Vite inlines VITE_SUPABASE_PROJECT_ID at build time), never from
// the .lovable.cloud proxy URL.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "autopilot-mcp",
  title: "Autopilot",
  version: "0.1.0",
  instructions:
    "Herramientas de Autopilot para asistentes conectados por MCP. Permiten leer el perfil, el plan de entrenamiento y de nutrición del usuario autenticado, listar registros de peso y añadir un nuevo registro de peso. Todas las llamadas se ejecutan como el usuario que ha autorizado el cliente (Supabase RLS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfile, getTrainingPlan, getNutritionPlan, listWeightLogs, logWeight],
});