/**
 * Inventario de pantallas para la auditoría visual.
 * Cada entrada: id, ruta, nombre legible y sección (para organizar capturas).
 */

export const VIEWPORTS = {
  desktop: { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  tablet: { name: "tablet", width: 834, height: 1112, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  mobile: { name: "mobile", width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};

/** Público: no necesita sesión. */
export const PUBLIC_SCREENS = [
  { id: "home", path: "/", name: "Landing", section: "publico" },
  { id: "planes", path: "/planes", name: "Planes", section: "publico" },
  { id: "como-funciona", path: "/como-funciona", name: "Cómo funciona", section: "publico" },
  { id: "equipo", path: "/equipo", name: "Equipo", section: "publico" },
  { id: "faq", path: "/preguntas-frecuentes", name: "Preguntas frecuentes", section: "publico" },
  { id: "recursos", path: "/recursos", name: "Recursos", section: "publico" },
  { id: "blog", path: "/blog", name: "Blog", section: "publico" },
  { id: "entrenadores", path: "/para-entrenadores", name: "Para entrenadores", section: "publico" },
  { id: "app", path: "/app", name: "Descargar app", section: "publico" },
  { id: "scan", path: "/scan", name: "Scan", section: "publico" },
  { id: "drive", path: "/drive", name: "Drive público", section: "publico" },
  { id: "legal-terminos", path: "/legal/terminos", name: "Términos", section: "legal" },
  { id: "legal-privacidad", path: "/legal/privacidad", name: "Privacidad", section: "legal" },
  { id: "login", path: "/login", name: "Entrar", section: "acceso" },
  { id: "signup", path: "/signup", name: "Crear cuenta", section: "acceso" },
  { id: "recuperar", path: "/forgot-password", name: "Recuperar contraseña", section: "acceso" },
  { id: "onboarding-choice", path: "/onboarding-choice", name: "Elegir camino", section: "onboarding" },
  { id: "404", path: "/esta-ruta-no-existe", name: "404", section: "sistema" },
];

/** Aplicación con sesión: el Dashboard resuelve el usuario y luego se navega por pestañas. */
export const APP_SCREENS = [
  { id: "inicio", tab: "Inicio", name: "Inicio", section: "app" },
  { id: "entrenar", tab: "Entrenar", name: "Entrenar · rutina", section: "app" },
  { id: "nutricion", tab: "Nutrición", name: "Nutrición", section: "app" },
  { id: "progreso", tab: "Progreso", name: "Progreso", section: "app" },
  { id: "ajustes", tab: "Ajustes", name: "Ajustes (pestaña)", section: "app" },
  { id: "recursos", tab: "Recursos", name: "Recursos (pestaña)", section: "app" },
];

export const EXTRA_APP_SCREENS = [
  { id: "settings-page", path: "/settings", name: "Ajustes · página", section: "app" },
  { id: "my-schedule", path: "/my-schedule", name: "Mi calendario", section: "app" },
];

export const ADMIN_SECTIONS = [
  ["dashboard", "Dashboard"],
  ["acquisition", "Crecimiento · Captación"],
  ["metrics", "Crecimiento · Negocio"],
  ["users", "Usuarios"],
  ["trainers", "Entrenadores"],
  ["reminders", "Recordatorios"],
  ["exercises", "Ejercicios"],
  ["drive", "Drive · Libros"],
  ["rules", "Reglas"],
  ["landing", "Landing"],
  ["blog", "Blog"],
  ["physiques", "Físicos"],
  ["payments", "Pagos"],
  ["emails", "Emails"],
  ["products", "Planes y productos"],
  ["account", "Mi cuenta"],
  ["roadmap", "Roadmap"],
];

export const ADMIN_SCREENS = ADMIN_SECTIONS.map(([id, name]) => ({
  id: `admin-${id}`,
  path: `/admin?s=${id}`,
  name,
  section: "admin",
}));

export const TRAINER_SCREENS = [
  { id: "trainer", path: "/trainer", name: "Panel del entrenador", section: "entrenador" },
];
