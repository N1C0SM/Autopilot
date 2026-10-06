import { useState, type ReactNode } from "react";
import { Search, Shield, UserCog, CalendarIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { Profile } from "@/pages/Admin";
import CreateTestAccountDialog, { type TestAccountKind } from "@/components/admin/CreateTestAccountDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { PaymentDot, PlanStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

interface Props {
  users: Profile[];
  adminIds: Set<string>;
  trainerIds?: Set<string>;
  onSelectUser: (user: Profile) => void;
  onTestAccountCreated: (profile: Profile, kind: TestAccountKind) => void;
}

type UserKind = "user" | "admin" | "trainer";

const STATUS_FILTERS = [
  { label: "Todos", value: "all" },
  { label: "Pagados", value: "paid" },
  { label: "Sin pagar", value: "unpaid" },
  { label: "Plan pendiente", value: "plan_pending" },
  { label: "Plan listo", value: "plan_ready" },
  { label: "En viaje", value: "traveling" },
] as const;

const isTraveling = (u: Profile) =>
  !!u.travel_mode_until && new Date(u.travel_mode_until) >= new Date();

// Fila única de usuario: 56px, avatar/icono, título, meta y a la derecha
// como máximo un badge de estado + un punto de pago.
const UserRow = ({ user: u, kind, onClick }: { user: Profile; kind: UserKind; onClick: () => void }) => {
  const name = u.name?.trim() || u.email;
  const meta =
    kind === "admin"
      ? "Administrador"
      : kind === "trainer"
        ? "Entrenador"
        : `${u.name?.trim() ? `${u.email} · ` : ""}Alta ${new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/40"
    >
      {kind === "user" ? (
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={u.avatar_url || undefined} alt={name} />
          <AvatarFallback className="bg-secondary text-xs font-semibold text-muted-foreground">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          {kind === "admin" ? <Shield className="h-4 w-4" /> : <UserCog className="h-4 w-4" />}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>

      {kind === "user" ? (
        <>
          <PlanStatusBadge planStatus={u.plan_status} traveling={isTraveling(u)} />
          <PaymentDot status={u.payment_status} />
        </>
      ) : (
        <StatusBadge tone="accent">{kind === "admin" ? "Admin" : "Entrenador"}</StatusBadge>
      )}
    </button>
  );
};

const UserGroup = ({
  title,
  users,
  kind,
  onSelectUser,
  empty,
}: {
  title: string;
  users: Profile[];
  kind: UserKind;
  onSelectUser: (user: Profile) => void;
  empty?: ReactNode;
}) => (
  <section>
    <SectionHeader title={title} className="mb-2" />
    {users.length === 0 ? (
      empty
    ) : (
      <Surface padding="none" className="divide-y divide-border overflow-hidden">
        {users.map((u) => (
          <UserRow key={u.user_id} user={u} kind={kind} onClick={() => onSelectUser(u)} />
        ))}
      </Surface>
    )}
  </section>
);

const UserList = ({ users, adminIds, trainerIds, onSelectUser, onTestAccountCreated }: Props) => {
  const trainerSet = trainerIds ?? new Set<string>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

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

    // Date range filter on registration date
    let inRange = true;
    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateRange.to ?? dateRange.from);
      to.setHours(23, 59, 59, 999);
      inRange = d >= from && d <= to;
    }

    if (filter === "all") return matchesSearch && inRange;
    if (filter === "paid") return matchesSearch && inRange && u.payment_status === "paid";
    if (filter === "unpaid") return matchesSearch && inRange && u.payment_status === "unpaid";
    if (filter === "traveling") return matchesSearch && inRange && isTraveling(u);
    return matchesSearch && inRange && u.plan_status === filter;
  };

  const regularUsers = users.filter((u) => !adminIds.has(u.user_id) && !trainerSet.has(u.user_id) && matchesFilters(u));
  const trainerUsers = users.filter((u) => trainerSet.has(u.user_id) && !adminIds.has(u.user_id) && matchesFilters(u));
  const adminUsers = users.filter((u) => adminIds.has(u.user_id) && matchesFilters(u));

  const rangeLabel = dateRange?.from
    ? dateRange.to
      ? `${dateRange.from.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${dateRange.to.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
      : dateRange.from.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    : "";

  return (
    <div>
      <SectionHeader
        title="Usuarios"
        hint={`${regularUsers.length} usuarios · ${trainerSet.size} entrenadores · ${adminIds.size} admin`}
        action={<CreateTestAccountDialog onCreated={onTestAccountCreated} />}
        className="mb-3"
      />

      {/* Una sola fila de filtros: búsqueda, fecha y estados (desplazable en horizontal) */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9"
            aria-label="Buscar usuario"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("h-11 shrink-0 gap-2 px-3 font-normal", dateRange?.from && "bg-primary/10")}
              title={rangeLabel || "Filtrar por fecha de registro"}
              aria-label="Filtrar por fecha de registro"
            >
              <CalendarIcon className="h-4 w-4 shrink-0" />
              {rangeLabel ? <span className="text-xs">{rangeLabel}</span> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50 bg-popover" align="end">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {dateRange?.from && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => setDateRange(undefined)}
            aria-label="Quitar filtro de fecha"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "h-11 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors",
                filter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <UserGroup
          title={`Usuarios (${regularUsers.length})`}
          users={regularUsers}
          kind="user"
          onSelectUser={onSelectUser}
          empty={
            <EmptyState
              icon={Search}
              title="Sin usuarios"
              description="Ajusta la búsqueda o los filtros para ver resultados."
            />
          }
        />

        {trainerUsers.length > 0 && (
          <UserGroup
            title={`Entrenadores (${trainerUsers.length})`}
            users={trainerUsers}
            kind="trainer"
            onSelectUser={onSelectUser}
          />
        )}

        {adminUsers.length > 0 && (
          <UserGroup
            title={`Administradores (${adminUsers.length})`}
            users={adminUsers}
            kind="admin"
            onSelectUser={onSelectUser}
          />
        )}
      </div>
    </div>
  );
};

export default UserList;
