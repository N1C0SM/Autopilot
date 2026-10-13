import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Mail,
  Globe,
  FileText,
  MailOpen,
  CreditCard,
  UserCog,
  Settings as SettingsIcon,
  LogOut,
  Layers,
  FolderOpen,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import autopilotLogo from "@/assets/autopilot-logo.png";
import type { AdminSection } from "@/pages/Admin";


interface Props {
  title: string;
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
  onSignOut: () => void;
}

const MENU: { label: string; section: AdminSection; icon: typeof Users }[] = [
  { label: "Usuarios", section: "users", icon: Users },
  { label: "Entrenadores", section: "trainers", icon: UserCog },
  { label: "Planes y productos", section: "products", icon: Layers },
  { label: "Pagos", section: "payments", icon: CreditCard },
  { label: "Drive · Libros", section: "drive", icon: FolderOpen },
  { label: "Recordatorios", section: "reminders", icon: Mail },
  { label: "Landing", section: "landing", icon: Globe },
  { label: "Blog", section: "blog", icon: FileText },
  { label: "Emails", section: "emails", icon: MailOpen },
];

/** Cabecera del panel admin en pantallas estrechas: logo + menú Perfil/Admin. */
const AdminMobileHeader = ({ title, section, onNavigate, onSignOut }: Props) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const go = (s: AdminSection) => {
    setOpen(false);
    onNavigate(s);
  };

  return (
    <header
      className="app-chrome sticky top-0 z-40 border-b-[0.5px] md:hidden"
      style={{
        paddingTop: "var(--safe-top, 0px)",
        paddingLeft: "var(--safe-left, 0px)",
        paddingRight: "var(--safe-right, 0px)",
      }}
    >
      <div className="relative flex h-11 items-center justify-end px-2">
        <h1 className="pointer-events-none absolute inset-x-0 mx-auto max-w-[60%] truncate text-center type-headline">
          {title}
        </h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Menú de administración"
              className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center transition-opacity active:opacity-60"
            >
              <img loading="lazy" decoding="async" src={autopilotLogo} alt="Autopilot" className="h-[30px] w-[30px] rounded-full object-cover" />
            </button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="w-[82vw] max-w-xs p-0 flex flex-col"
            style={{
              paddingTop: "var(--safe-top, 0px)",
              paddingBottom: "var(--safe-bottom, 0px)",
              paddingRight: "var(--safe-right, 0px)",
            }}
          >
            <div className="px-5 pb-2 pt-4">
              <span className="type-title2">Admin</span>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pb-3">
              {MENU.map((m) => {
                const isActive = section === m.section;
                return (
                  <button
                    key={m.section}
                    type="button"
                    onClick={() => go(m.section)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left type-body transition-colors active:bg-accent ${
                      isActive ? "bg-secondary font-semibold" : ""
                    }`}
                  >
                    <m.icon className="h-5 w-5 shrink-0 text-primary" />
                    {m.label}
                  </button>
                );
              })}
              <div className="my-2 h-[0.5px] bg-border" />
              <button
                type="button"
                onClick={() => go("account")}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left type-body transition-colors active:bg-accent"
              >
                <SettingsIcon className="h-5 w-5 shrink-0 text-primary" /> Mi cuenta
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); onSignOut(); }}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left type-body text-destructive transition-colors active:bg-accent"
              >
                <LogOut className="h-5 w-5 shrink-0" /> Cerrar sesión
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default AdminMobileHeader;
