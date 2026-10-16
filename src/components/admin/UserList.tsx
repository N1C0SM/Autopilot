import { useState } from "react";
import { Search, CalendarIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/native";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Profile } from "@/pages/Admin";
import CreateTestAccountDialog, { type TestAccountKind } from "@/components/admin/CreateTestAccountDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListGroup, ListRow } from "@/components/ui/list";
import { PaymentDot, PlanStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipBar } from "./AdminOpsParts";

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

// Fila única de usuario: avatar, nombre, meta y, a la derecha, el estado del plan
// y un punto de pago (solo clientes). Toda la fila abre la ficha.
const UserRow = ({ user: u, kind, onClick }: { user: Profile; kind: UserKind; onClick: () => void }) => {
  const name = u.name?.trim() || u.email;
  const meta =
    kind === "admin"
      ? "Administrador"
      : kind === "trainer"
        ? "Entrenador"
        : `${u.name?.trim() ? `${u.email} · ` : ""}Alta ${new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <ListRow
      onClick={onClick}
      leading={
        <Avatar className="h-9 w-9">
          <AvatarImage src={u.avatar_url || undefined} alt="" />
          <AvatarFallback className="type-footnote font-semibold text-muted-foreground">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      }
      title={<span className="block truncate">{name}</span>}
      subtitle={<span className="block truncate">{meta}</span>}
      value={
        kind === "user" ? (
          <span className="flex items-center gap-2">
            <PlanStatusBadge planStatus={u.plan_status} traveling={isTraveling(u)} className="type-caption1" />
            <PaymentDot status={u.payment_status} title={undefined} />
          </span>
        ) : undefined
      }
      chevron
    />
  );
};

const UserGroup = ({
  title,
  users,
  kind,
  onSelectUser,
}: {
  title: string;
  users: Profile[];
  kind: UserKind;
  onSelectUser: (user: Profile) => void;
}) => (
  <ListGroup header={title}>
    {users.map((u) => (
      <UserRow key={u.user_id} user={u} kind={kind} onClick={() => onSelectUser(u)} />
    ))}
  </ListGroup>
);

const UserList = ({ users, adminIds, trainerIds, onSelectUser, onTestAccountCreated }: Props) => {
  const isMobile = useIsMobile();
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

  const noResults = regularUsers.length === 0 && trainerUsers.length === 0 && adminUsers.length === 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4">
        <p className="type-subhead text-muted-foreground">
          {regularUsers.length} usuarios · {trainerSet.size} entrenadores · {adminIds.size} admin
        </p>
        <CreateTestAccountDialog onCreated={onTestAccountCreated} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar usuario"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              className={cn("min-w-[44px] shrink-0 gap-2 px-3 font-normal", dateRange?.from && "bg-primary/15 text-primary")}
              aria-label="Filtrar por fecha de registro"
            >
              <CalendarIcon className="h-4 w-4 shrink-0" />
              {rangeLabel ? <span className="type-footnote">{rangeLabel}</span> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end" onOpenAutoFocus={isMobile ? (e) => e.preventDefault() : undefined}>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={isMobile ? 1 : 2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {dateRange?.from && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => { void hapticTap(); setDateRange(undefined); }}
            aria-label="Quitar filtro de fecha"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ChipBar options={STATUS_FILTERS} value={filter} onChange={setFilter} aria-label="Filtrar por estado" className="mb-4" />

      {noResults ? (
        <EmptyState
          icon={Search}
          title="Sin usuarios"
          description="Ajusta la búsqueda o los filtros para ver resultados."
        />
      ) : (
        <div className="space-y-6">
          {regularUsers.length > 0 && (
            <UserGroup
              title={`Clientes (${regularUsers.length})`}
              users={regularUsers}
              kind="user"
              onSelectUser={onSelectUser}
            />
          )}

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
      )}
    </div>
  );
};

export default UserList;
