import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/shared/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import {
  acquisitionMetadata,
  captureFirstTouch,
  claimAcquisition,
  FIRST_TOUCH_TTL_MS,
  isStaffDevice,
  markStaffDevice,
  parseTouch,
  readFirstTouch,
  recordAcquisitionEvent,
} from "@/shared/lib/acquisition";

const NOW = Date.parse("2026-10-29T12:00:00Z");

beforeEach(() => {
  localStorage.clear();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("parseTouch", () => {
  it("lee utm_source, utm_medium y utm_campaign en minúsculas", () => {
    expect(parseTouch("?utm_source=TikTok&utm_medium=bio&utm_campaign=Scan_Oct", "/scan", "", NOW))
      .toEqual({ source: "tiktok", medium: "bio", campaign: "scan_oct", landing: "/scan", at: NOW });
  });

  it("acepta ref cuando no hay utm_source", () => {
    expect(parseTouch("?ref=instagram", "/", "", NOW).source).toBe("instagram");
  });

  it("usa el dominio del referrer externo como fuente", () => {
    expect(parseTouch("", "/", "https://l.instagram.com/?u=x", NOW)).toMatchObject({ source: "l.instagram.com", medium: "referral" });
  });

  it("ignora la propia web como referrer: es directo", () => {
    expect(parseTouch("", "/planes", "https://autopilotplan.com/", NOW).source).toBeNull();
  });
});

describe("captureFirstTouch", () => {
  it("guarda el primer contacto y lo marca como visitante nuevo", () => {
    const first = captureFirstTouch({ search: "?utm_source=tiktok&utm_medium=bio", pathname: "/" }, "", NOW);
    expect(first.isNew).toBe(true);
    expect(readFirstTouch(NOW)?.source).toBe("tiktok");
  });

  it("no sobrescribe una fuente ya guardada (primer toque)", () => {
    captureFirstTouch({ search: "?utm_source=tiktok", pathname: "/" }, "", NOW);
    const again = captureFirstTouch({ search: "?utm_source=instagram", pathname: "/scan" }, "", NOW + 1000);
    expect(again).toMatchObject({ isNew: false, touch: { source: "tiktok", landing: "/" } });
  });

  it("mejora una visita directa con la primera fuente real, sin contar otra visita", () => {
    captureFirstTouch({ search: "", pathname: "/" }, "", NOW);
    const later = captureFirstTouch({ search: "?utm_source=youtube", pathname: "/scan" }, "", NOW + 1000);
    expect(later).toMatchObject({ isNew: false, touch: { source: "youtube" } });
  });

  it("caduca a los 30 días", () => {
    captureFirstTouch({ search: "?utm_source=tiktok", pathname: "/" }, "", NOW);
    expect(readFirstTouch(NOW + FIRST_TOUCH_TTL_MS + 1)).toBeNull();
    const fresh = captureFirstTouch({ search: "?utm_source=threads", pathname: "/" }, "", NOW + FIRST_TOUCH_TTL_MS + 1);
    expect(fresh).toMatchObject({ isNew: true, touch: { source: "threads" } });
  });
});

describe("persistencia", () => {
  it("acquisitionMetadata solo lleva campos con valor", () => {
    expect(acquisitionMetadata(null)).toEqual({});
    expect(acquisitionMetadata({ source: "tiktok", medium: null, campaign: null, landing: "/scan", at: NOW }))
      .toEqual({ acq_source: "tiktok", acq_landing: "/scan" });
  });

  it("recordAcquisitionEvent envía tipo y fuente y nunca lanza", async () => {
    await recordAcquisitionEvent("scan", { source: "tiktok", medium: "bio", campaign: null, landing: "/scan", at: NOW });
    expect(rpc).toHaveBeenCalledWith("record_acquisition_event", { _kind: "scan", _source: "tiktok", _medium: "bio", _campaign: null });
    rpc.mockRejectedValueOnce(new Error("offline"));
    await expect(recordAcquisitionEvent("visit", null)).resolves.toBeUndefined();
  });

  it("claimAcquisition reclama una sola vez por cuenta", async () => {
    const touch = { source: "instagram", medium: "bio", campaign: null, landing: "/", at: NOW };
    await claimAcquisition("user-1", touch);
    await claimAcquisition("user-1", touch);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("claim_acquisition", { _source: "instagram", _medium: "bio", _campaign: null, _landing: "/" });
  });

  it("claimAcquisition reintenta si la base de datos falla", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const touch = { source: "tiktok", medium: null, campaign: null, landing: "/", at: NOW };
    await claimAcquisition("user-2", touch);
    await claimAcquisition("user-2", touch);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe("navegador del equipo", () => {
  it("no registra visitas, scans ni origen del alta desde un navegador marcado", async () => {
    markStaffDevice();
    await recordAcquisitionEvent("visit", { source: "tiktok", medium: "bio", campaign: null, landing: "/", at: NOW });
    expect(rpc).not.toHaveBeenCalled();
    expect(acquisitionMetadata({ source: "tiktok", medium: "bio", campaign: null, landing: "/", at: NOW })).toEqual({});
  });

  it("se marca al entrar una vez con ?no_contar=1", () => {
    expect(isStaffDevice("")).toBe(false);
    expect(isStaffDevice("?no_contar=1")).toBe(true);
    expect(isStaffDevice("")).toBe(true);
  });
});
