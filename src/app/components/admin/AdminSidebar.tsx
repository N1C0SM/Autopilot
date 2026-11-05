import { ArrowLeftRight } from "lucide-react";
import { BrandMark } from "@/shared/components/ui/brand-mark";
import { openAccountPicker } from "@/shared/lib/accounts";
import { supportsMultipleAccounts } from "@/shared/lib/platform";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { LogOut } from "lucide-react";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "@/app/components/admin/adminNav";
import type { AdminSection } from "@/app/pages/Admin";
import { hapticTap } from "@/shared/lib/native";

interface Props {
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
  userCount: number;
  onSignOut: () => void;
}

type NavItem = AdminNavItem;

const AdminSidebar = ({ section, onNavigate, userCount, onSignOut }: Props) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const navButton = (item: NavItem) => (
    <SidebarMenuItem key={item.section}>
      <SidebarMenuButton
        isActive={section === item.section}
        aria-current={section === item.section ? "page" : undefined}
        tooltip={item.title}
        className="data-[active=true]:bg-primary/15 data-[active=true]:hover:bg-primary/20"
        onClick={() => { void hapticTap(); onNavigate(item.section); }}
      >
        <item.icon aria-hidden="true" />
        {!collapsed && (
          <span className="flex flex-1 items-center justify-between gap-2">
            <span className="truncate">{item.title}</span>
            {item.section === "users" && (
              <span className="type-footnote tabular-nums text-muted-foreground">{userCount}</span>
            )}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 pb-1 pt-4 group-data-[collapsible=icon]:px-2">
        {collapsed ? (
          <span className="flex justify-center"><BrandMark size={24} label="Autopilot" /></span>
        ) : (
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="text-[18px] font-bold tracking-[0.01em]">AUTOPILOT</span>
            <span className="type-subhead text-muted-foreground">Admin</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {ADMIN_NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{group.items.map(navButton)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {supportsMultipleAccounts() && <SidebarMenuItem>
            <SidebarMenuButton tooltip="Cambiar de cuenta" onClick={() => { void hapticTap(); openAccountPicker(); }}>
              <ArrowLeftRight aria-hidden="true" />
              {!collapsed && <span>Cambiar de cuenta</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Cerrar sesión" onClick={() => { void hapticTap(); onSignOut(); }} className="text-destructive hover:text-destructive active:text-destructive">
              <LogOut aria-hidden="true" />
              {!collapsed && <span>Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
