import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "@/web/pages/Index";
import { supabase } from "@/shared/integrations/supabase/client";

vi.mock("@/shared/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/shared/lib/freeCampaign", () => ({ useFreeCampaign: () => false }));
vi.mock("@/shared/lib/planCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/planCatalog")>();
  const plans = actual.fallbackCatalog();
  return { ...actual, usePlanCatalog: () => plans, usePlanAvailability: () => actual.availabilityFrom(plans) };
});
vi.mock("@/shared/lib/native", () => ({ hapticTap: vi.fn(), isNative: vi.fn().mockReturnValue(false) }));
vi.mock("@/shared/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [{ show_app_download: false }], error: null }),
  },
}));
function Destination() {
  const location = useLocation();
  return <p data-testid="destination">{location.pathname}{location.search}{location.hash}</p>;
}
function open(path = "/") {
  return render(<HelmetProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/" element={<Index />} /><Route path="*" element={<Destination />} />
  </Routes></MemoryRouter></HelmetProvider>);
}
beforeEach(() => { vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }); vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("short public home", () => {
  it("takes the clear primary action to the routine configurator", async () => {
    open();
    const main = await screen.findByRole("main");
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Convierte la disciplina");
    fireEvent.click(within(main).getAllByRole("link", { name: /Empezar gratis/ })[0]);
    expect(screen.getByTestId("destination")).toHaveTextContent("/onboarding");
  });

  it("shows the demo link, the real Free price and the full comparison", async () => {
    open();
    const main = await screen.findByRole("main");
    expect(within(main).getByRole("link", { name: /Ver demo/ })).toHaveAttribute("href", "/como-funciona#demo");
    expect(within(main).getByText(/Free — 0 €/)).toBeInTheDocument();
    expect(within(main).getByRole("link", { name: "Ver la comparativa completa" })).toHaveAttribute("href", "/planes");
  });

  describe("devices section with store links", () => {
    const withSettings = async (row: Record<string, unknown>, check: () => Promise<void>) => {
      const rpc = vi.mocked(supabase.rpc);
      const original = rpc.getMockImplementation();
      rpc.mockResolvedValue({ data: [row], error: null } as never);
      try { await check(); } finally { rpc.mockImplementation(original!); }
    };
    const heading = /Todo tu progreso/;

    it("hides the whole section when no store link is set", async () => {
      await withSettings({ app_store_url: "", mac_store_url: "", play_store_url: "" }, async () => {
        open();
        const main = await screen.findByRole("main");
        await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith("get_public_settings"));
        expect(within(main).queryByRole("heading", { name: heading })).not.toBeInTheDocument();
        expect(within(main).queryByText("Android")).not.toBeInTheDocument();
      });
    });

    it("shows only the configured store, with its real logo and link", async () => {
      await withSettings({ app_store_url: "", play_store_url: "https://play.google.com/store/apps/details?id=x" }, async () => {
        open();
        const main = await screen.findByRole("main");
        expect(await within(main).findByRole("heading", { name: heading })).toBeInTheDocument();
        const play = within(main).getByRole("link", { name: /Google Play/ });
        expect(play).toHaveAttribute("href", "https://play.google.com/store/apps/details?id=x");
        expect(play.querySelectorAll("svg path")).toHaveLength(4);
        expect(within(main).queryByRole("link", { name: /App Store/ })).not.toBeInTheDocument();
      });
    });

    it("shows App Store, Mac App Store and Google Play when all three are set", async () => {
      await withSettings({ app_store_url: "https://apps.apple.com/app/id1", mac_store_url: "https://apps.apple.com/app/id2", play_store_url: "https://play.google.com/x" }, async () => {
        open();
        const main = await screen.findByRole("main");
        await within(main).findByRole("heading", { name: heading });
        expect(within(main).getByRole("link", { name: "Descargar en App Store" })).toHaveAttribute("href", "https://apps.apple.com/app/id1");
        expect(within(main).getByRole("link", { name: "Descargar en Mac App Store" })).toHaveAttribute("href", "https://apps.apple.com/app/id2");
        expect(within(main).getByRole("link", { name: /Google Play/ })).toHaveAttribute("href", "https://play.google.com/x");
      });
    });

    it("stays hidden with links when the admin switch is off", async () => {
      await withSettings({ show_store_badges: false, app_store_url: "https://apps.apple.com/app/id1" }, async () => {
        open();
        const main = await screen.findByRole("main");
        await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith("get_public_settings"));
        expect(within(main).queryByRole("heading", { name: heading })).not.toBeInTheDocument();
      });
    });
  });

  it("opens mobile navigation and reaches the questions page", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir menú" }));
    const menu = screen.getByRole("navigation", { name: "Menú móvil" });
    fireEvent.click(within(menu).getByRole("link", { name: "Soporte" }));
    expect(screen.getByTestId("destination")).toHaveTextContent("/preguntas-frecuentes");
  });

  it.each([
    ["/#pricing", "/planes"], ["/?utm_source=example#ver-app", "/como-funciona?utm_source=example#demo"],
    ["/#equipo", "/equipo"], ["/#como-funciona", "/como-funciona"],
  ])("preserves old section links: %s", (from, expected) => {
    open(from);
    expect(screen.getByTestId("destination").textContent).toBe(expected);
  });
});
