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
  { label: "Recordatorios", section: "reminders", icon: Mail },
  { label: "Landing", section: "landing", icon: Globe },
  { label: "Blog", section: "blog", icon: FileText },
  { label: "Emails", section: "emails", icon: MailOpen },
  { label: "Pagos", section: "payments", icon: CreditCard },
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
      className="sticky top-0 z-40 md:hidden bg-card/95 backdrop-blur-xl border-b border-border"
      style={{
        paddingTop: "var(--safe-top, 0px)",
        paddingLeft: "var(--safe-left, 0px)",
        paddingRight: "var(--safe-right, 0px)",
      }}
    >
      <div className="h-14 px-3 flex items-center gap-2">
        <span className="font-display text-base font-bold text-gradient shrink-0">Autopilot</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground truncate flex-1">
          {title}
        </span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Menú de administración"
              className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full border border-border bg-secondary/60 overflow-hidden active:opacity-70"
            >
              <img src={autopilotLogo} alt="Autopilot" className="h-7 w-7 rounded-full object-cover" />
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
            <div className="px-5 py-4 border-b border-border">
              <span className="font-display text-lg font-bold text-gradient">Autopilot</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-2">Admin</span>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {MENU.map((m) => {
                const isActive = section === m.section;
                return (
                  <button
                    key={m.section}
                    type="button"
                    onClick={() => go(m.section)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-left transition-colors ${
                      isActive ? "bg-secondary text-primary font-semibold" : "hover:bg-secondary/60"
                    }`}
                  >
                    <m.icon className="w-4 h-4 shrink-0" />
                    {m.label}
                  </button>
                );
              })}
              <div className="h-px bg-border my-2" />
              <button
                type="button"
                onClick={() => { setOpen(false); navigate("/settings"); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-left hover:bg-secondary/60 transition-colors"
              >
                <SettingsIcon className="w-4 h-4 shrink-0" /> Mi cuenta
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); onSignOut(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-left text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" /> Cerrar sesión
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default AdminMobileHeader;
