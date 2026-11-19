import { describe, expect, it } from "vitest";
import {
  CREDITS_PER_CLIP,
  formatCredits,
  isCreditsError,
  planExerciseKeys,
  planVideoConfirmTitle,
  planVideoCredits,
  planVideoDone,
  planVideoEstimate,
  planVideoNeedPhoto,
  planVideoProgress,
  planVideoQueue,
  planVideoSummary,
} from "@/shared/lib/planVideos";

const library = [
  { id: "a", name: "Press banca", image_url: "https://x/a.webp", video_url: "https://x/a.mp4" },
  { id: "b", name: "Sentadilla", image_url: "https://x/b.webp", video_url: null },
  { id: "c", name: "Dominadas", image_url: null, video_url: null },
  { id: "d", name: "Remo con barra", image_url: "https://x/d.webp", video_url: "" },
  { id: "e", name: "Curl de bíceps", image_url: "https://x/e.webp", video_url: null },
];

describe("vídeos de los ejercicios de los planes", () => {
  it("junta los ejercicios de todos los planes por id y por nombre, sin repetir", () => {
    const keys = planExerciseKeys([
      [{ day: "A", exercises: [{ exercise_id: "a", name: "Press banca" }, { exercise_id: "", name: " sentadilla " }] }],
      [{ day: "B", type: "actividad" }, { day: "C", exercises: [{ exercise_id: "a", name: "Press banca" }, { name: "Remo con barra" }] }],
      null,
      "roto",
      [{ day: "D", exercises: "no" }],
    ]);
    expect([...keys.ids]).toEqual(["a"]);
    expect([...keys.names].sort()).toEqual(["press banca", "remo con barra", "sentadilla"]);
  });

  it("cuenta los que usan los planes, salta los que ya tienen vídeo y separa los que necesitan foto", () => {
    const keys = planExerciseKeys([[{ exercises: [{ exercise_id: "a", name: "Press banca" }, { exercise_id: "c", name: "Dominadas" }, { name: "Sentadilla" }, { name: "REMO CON BARRA" }] }]]);
    const queue = planVideoQueue(library, keys);
    expect(queue.inPlans).toBe(4);
    expect(queue.withVideo).toBe(1);
    expect(queue.missing.map((e) => e.id)).toEqual(["c", "d", "b"]);
    expect(queue.ready.map((e) => e.id)).toEqual(["d", "b"]);
    expect(queue.needPhoto.map((e) => e.id)).toEqual(["c"]);
    // «Curl de bíceps» no está en ningún plan: no se cuenta ni se genera.
    expect(queue.missing.some((e) => e.id === "e")).toBe(false);
  });

  it("estima 1,6 créditos por clip de 4 s, con coma decimal", () => {
    expect(CREDITS_PER_CLIP).toBe(1.6);
    expect(planVideoCredits(12)).toBe(19.2);
    expect(planVideoCredits(40)).toBe(64);
    expect(formatCredits(planVideoCredits(1))).toBe("1,6");
    expect(planVideoEstimate(12)).toBe("12 vídeos de 4 s · ≈19,2 créditos de Lovable (1,6 por vídeo)");
    expect(planVideoEstimate(1)).toBe("1 vídeo de 4 s · ≈1,6 créditos de Lovable (1,6 por vídeo)");
  });

  it("textos con su plural: resumen, confirmación, progreso, fotos pendientes y final", () => {
    expect(planVideoSummary({ inPlans: 40, withVideo: 28, missing: new Array(12) })).toBe("40 ejercicios en los planes · 28 con vídeo · 12 sin vídeo");
    expect(planVideoSummary({ inPlans: 1, withVideo: 0, missing: new Array(1) })).toBe("1 ejercicio en los planes · 0 con vídeo · 1 sin vídeo");
    expect(planVideoConfirmTitle(12)).toBe("¿Generar 12 vídeos?");
    expect(planVideoConfirmTitle(1)).toBe("¿Generar 1 vídeo?");
    expect(planVideoProgress(12, 40)).toBe("Generando 12 de 40");
    expect(planVideoNeedPhoto(1)).toContain("1 necesita antes su foto");
    expect(planVideoNeedPhoto(3)).toContain("3 necesitan antes su foto");
    expect(planVideoDone(10, 12, false)).toBe("Listo: 10 vídeos nuevos.");
    expect(planVideoDone(1, 1, false)).toBe("Listo: 1 vídeo nuevo.");
    expect(planVideoDone(4, 12, true)).toBe("Parado: 4 de 12 vídeos creados.");
  });

  it("un error de saldo para toda la cola", () => {
    expect(isCreditsError("Sin créditos de IA suficientes")).toBe(true);
    expect(isCreditsError("La generación del vídeo falló")).toBe(false);
  });
});
