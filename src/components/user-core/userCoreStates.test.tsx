import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BeforeAfterCompare from "@/components/dashboard/BeforeAfterCompare";
import NotificationsBell from "@/components/NotificationsBell";
import Recursos from "@/pages/Recursos";

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  user: null as { id: string } | null,
}));

vi.mock("@/lib/native", () => ({ hapticTap: vi.fn(), hapticSelection: vi.fn(), isNative: vi.fn().mockReturnValue(false) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, signOut: vi.fn() }) }));
vi.mock("@/lib/planCatalog", () => ({ usePlanAvailability: () => ({ coach: false, coachName: "Coach" }) }));
vi.mock("@/components/UserSidebar", () => ({ default: () => null }));
vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const query = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "ilike", "order", "limit"]) q[method] = () => q;
    q.maybeSingle = () => Promise.resolve({ data: null, error: null });
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mocks.tables[table] ?? [], error: null }).then(resolve);
    return q;
  };
  return {
    supabase: {
      from: query,
      rpc: (name: string) => Promise.resolve({ data: name === "get_payment_mode" ? "test" : null }),
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) },
      channel: () => {
        const channel = { on: () => channel, subscribe: () => channel };
        return channel;
      },
      removeChannel: vi.fn(),
    },
  };
});

beforeEach(() => {
  mocks.tables = {};
  mocks.user = null;
});
afterEach(cleanup);

const photo = (id: string, takenAt: string) => ({ id, note: "Frente", photo_url: `user/${id}.jpg`, taken_at: takenAt });
const photos = [photo("new", "2026-10-10"), photo("old", "2026-08-01")];

describe("before and after compare fallbacks", () => {
  it("says the photos are unavailable once, not once per layer, when both fail", () => {
    const signed = new Map(photos.map((p) => [p.photo_url, `https://signed.test/${p.id}`]));
    render(<BeforeAfterCompare photos={photos} signed={signed} onClose={vi.fn()} />);

    fireEvent.error(screen.getByAltText("Antes"));
    fireEvent.error(screen.getByAltText("Después"));

    expect(screen.getAllByText("Fotos no disponibles")).toHaveLength(1);
    expect(screen.queryByText("Foto no disponible")).not.toBeInTheDocument();
  });

  it("uses neutral wording while the signed URLs are not ready", () => {
    render(<BeforeAfterCompare photos={photos} signed={new Map()} onClose={vi.fn()} />);

    expect(screen.getByText("Cargando fotos…")).toBeInTheDocument();
    expect(screen.queryByText("Fotos no disponibles")).not.toBeInTheDocument();
  });

  it("keeps the other photo when only one fails, with no text on the placeholder", () => {
    const signed = new Map(photos.map((p) => [p.photo_url, `https://signed.test/${p.id}`]));
    render(<BeforeAfterCompare photos={photos} signed={signed} onClose={vi.fn()} />);

    fireEvent.error(screen.getByAltText("Antes"));

    expect(screen.getByAltText("Después")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Antes: foto no disponible" })).toBeInTheDocument();
    expect(screen.queryByText("Fotos no disponibles")).not.toBeInTheDocument();
  });
});

describe("notifications bell", () => {
  it("includes the unread count in the button name", async () => {
    mocks.tables.notifications = [
      { id: "a", type: "reminder", title: "Entrena", message: "Hoy toca", read: false, created_at: new Date().toISOString() },
      { id: "b", type: "reminder", title: "Come", message: "Comida", read: false, created_at: new Date().toISOString() },
      { id: "c", type: "reminder", title: "Visto", message: "Ya leído", read: true, created_at: new Date().toISOString() },
    ];
    render(<NotificationsBell userId="user" />);

    expect(await screen.findByRole("button", { name: "Notificaciones, 2 sin leer" })).toBeInTheDocument();
  });

  it("is just Notificaciones when everything is read", async () => {
    render(<NotificationsBell userId="user" />);

    expect(await screen.findByRole("button", { name: "Notificaciones" })).toBeInTheDocument();
  });
});

describe("resources screen", () => {
  it("embedded has no title of its own and shows the empty state once loaded", async () => {
    render(<MemoryRouter><Recursos embedded /></MemoryRouter>);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Cargando recursos" })).toBeInTheDocument();
    expect(await screen.findByText("Sin recursos todavía")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Cargando recursos" })).not.toBeInTheDocument();
  });

  it("standalone keeps its title and a back button named by its visible text", async () => {
    // Signed-in users get the app shell with «Atrás»; visitors get the public layout.
    mocks.user = { id: "user" };
    render(<MemoryRouter><Recursos /></MemoryRouter>);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atrás" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Sin recursos todavía")).toBeInTheDocument());
  });

  it("lists published articles instead of the empty state", async () => {
    mocks.tables.blog_posts = [{ slug: "fuerza", title: "Cómo ganar fuerza", excerpt: null, cover_url: null }];
    render(<MemoryRouter><Recursos embedded /></MemoryRouter>);

    expect(await screen.findByText("Cómo ganar fuerza")).toBeInTheDocument();
    expect(screen.queryByText("Sin recursos todavía")).not.toBeInTheDocument();
  });
});
