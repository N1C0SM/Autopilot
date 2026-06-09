import { useState } from "react";
import { Users, Search, Shield, UserCog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/pages/Admin";

interface Props {
  users: Profile[];
  adminIds: Set<string>;
  trainerIds?: Set<string>;
  onSelectUser: (user: Profile) => void;
}

const STATUS_FILTERS = [
  { label: "Todos", value: "all" },
  { label: "Pagados", value: "paid" },
  { label: "Sin pagar", value: "unpaid" },
  { label: "Plan pendiente", value: "plan_pending" },
  { label: "Plan listo", value: "plan_ready" },
  { label: "✈️ En viaje", value: "traveling" },
] as const;

const UserList = ({ users, adminIds, trainerIds, onSelectUser }: Props) => {
  const trainerSet = trainerIds ?? new Set<string>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const matchesFilters = (u: Profile) => {
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const d = new Date(u.created_at);
    const dateParts = [
      d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
      d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
      d.toLocaleDateString("es-ES"),
      d.toISOString().slice(0, 10),
      String(d.getFullYear()),
    ].join(" ");
    const haystack = normalize(`${u.name || ""} ${u.email} ${dateParts}`);
    const tokens = normalize(search).split(/\s+/).filter(Boolean);
    const matchesSearch = tokens.every((t) => haystack.includes(t));
    if (filter === "all") return matchesSearch;
    if (filter === "paid") return matchesSearch && u.payment_status === "paid";
    if (filter === "unpaid") return matchesSearch && u.payment_status === "unpaid";
    if (filter === "traveling") {
      return matchesSearch && !!u.travel_mode_until && new Date(u.travel_mode_until) >= new Date();
    }
    return matchesSearch && u.plan_status === filter;
  };

  const isTraveling = (u: Profile) => !!u.travel_mode_until && new Date(u.travel_mode_until) >= new Date();

  const regularUsers = users.filter((u) => !adminIds.has(u.user_id) && !trainerSet.has(u.user_id) && matchesFilters(u));
  const trainerUsers = users.filter((u) => trainerSet.has(u.user_id) && !adminIds.has(u.user_id) && matchesFilters(u));
  const adminUsers = users.filter((u) => adminIds.has(u.user_id) && matchesFilters(u));

  const renderUserCard = (u: Profile, kind: "user" | "admin" | "trainer" = "user") => (
    <div
      key={u.user_id}
      className="bg-card rounded-xl p-4 border border-border flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 group"
      onClick={() => onSelectUser(u)}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${kind === "admin" ? "bg-primary/20" : kind === "trainer" ? "bg-amber-500/20" : "bg-secondary"}`}>
        {kind === "admin" ? (
          <Shield className="w-4 h-4 text-primary" />
        ) : kind === "trainer" ? (
          <UserCog className="w-4 h-4 text-amber-400" />
        ) : (
          <span className="text-sm font-bold text-muted-foreground">
            {(u.name?.trim() || u.email).charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
          {u.name?.trim() || u.email}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {u.name?.trim() ? u.email + " · " : ""}
          Registrado {new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>

      {kind === "admin" ? (
        <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">
          Admin
        </Badge>
      ) : kind === "trainer" ? (
        <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
          Entrenador
        </Badge>
      ) : (
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {isTraveling(u) && (
            <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
              ✈️ Viaje
            </Badge>
          )}
          <Badge variant={u.payment_status === "paid" ? "default" : "destructive"} className="text-[10px]">
            {u.payment_status === "paid" ? "💳 Pagado" : "⏳ Sin pagar"}
          </Badge>
          <Badge
            variant="secondary"
            className={`text-[10px] ${u.plan_status === "plan_ready" ? "bg-primary/20 text-primary border-primary/30" : ""}`}
          >
            {u.plan_status === "plan_ready" ? "✅ Plan listo" : u.plan_status === "plan_pending" ? "📋 Pendiente" : "🆕 Onboarding"}
          </Badge>
        </div>
      )}

      <div className="text-muted-foreground group-hover:text-primary transition-colors">
        →
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold font-display">Usuarios</h1>
        <span className="text-sm text-muted-foreground ml-2">
          ({regularUsers.length + trainerUsers.length} usuarios · {trainerSet.size} entrenadores · {adminIds.size} admin)
        </span>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o fecha de registro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Regular users */}
      <div className="mb-8">
        <h2 className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Usuarios ({regularUsers.length})
        </h2>
        <div className="space-y-2">
          {regularUsers.map((u) => renderUserCard(u, "user"))}
          {regularUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No se encontraron usuarios
            </div>
          )}
        </div>
      </div>

      {/* Trainers */}
      {trainerUsers.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display font-bold text-xs uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
            <UserCog className="w-3 h-3" /> Entrenadores ({trainerUsers.length})
          </h2>
          <div className="space-y-2">
            {trainerUsers.map((u) => renderUserCard(u, "trainer"))}
          </div>
        </div>
      )}

      {/* Admins */}
      {adminUsers.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
            <Shield className="w-3 h-3" /> Administradores ({adminUsers.length})
          </h2>
          <div className="space-y-2">
            {adminUsers.map((u) => renderUserCard(u, "admin"))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
