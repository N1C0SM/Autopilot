import { LayoutDashboard, Users, UserCog, Dumbbell, SlidersHorizontal, Mail, Globe, CreditCard, MailOpen, Target, FileText, FolderOpen, Layers, UserCircle, Route, TrendingUp } from "lucide-react";
import type { AdminSection } from "@/app/pages/Admin";

export type AdminNavItem = { title: string; section: AdminSection; icon: typeof LayoutDashboard };

/** Única lista de secciones de Admin: la usan la barra lateral (Mac, web) y el menú del iPhone, así nunca se separan. */
export const ADMIN_NAV_GROUPS: { label: string; items: AdminNavItem[] }[] = [
  { label: "General", items: [
    { title: "Dashboard", section: "dashboard", icon: LayoutDashboard },
    { title: "Crecimiento", section: "acquisition", icon: TrendingUp },
    { title: "Roadmap", section: "roadmap", icon: Route },
  ] },
  { label: "Personas", items: [
    { title: "Usuarios", section: "users", icon: Users },
    { title: "Entrenadores", section: "trainers", icon: UserCog },
    { title: "Recordatorios", section: "reminders", icon: Mail },
  ] },
  { label: "Entrenamiento", items: [
    { title: "Ejercicios", section: "exercises", icon: Dumbbell },
    { title: "Reglas", section: "rules", icon: SlidersHorizontal },
    { title: "Físicos", section: "physiques", icon: Target },
    { title: "Drive · Libros", section: "drive", icon: FolderOpen },
  ] },
  { label: "Contenido", items: [
    { title: "Landing", section: "landing", icon: Globe },
    { title: "Blog", section: "blog", icon: FileText },
    { title: "Emails", section: "emails", icon: MailOpen },
  ] },
  { label: "Negocio", items: [
    { title: "Planes y productos", section: "products", icon: Layers },
    { title: "Pagos", section: "payments", icon: CreditCard },
  ] },
  { label: "Cuenta", items: [
    { title: "Mi cuenta", section: "account", icon: UserCircle },
  ] },
];
