import { describe, expect, it } from "vitest";
import { parseRecommendations } from "@/shared/lib/siteContent";
import { errorMessage, errorStatus, functionErrorMessage } from "@/shared/lib/runtimeValues";

describe("public settings JSON", () => {
  it("keeps valid recommendations and rejects malformed entries without crashing", () => {
    expect(parseRecommendations([null, 42, "bad", [], { title: 42 }, {
      id: "existing", title: "Guía", description: "Texto guardado", image_url: "https://example.com/a.webp",
      url: "https://example.com/guide", badge: "Recomendado",
    }, { title: "Parcial", description: {} }])).toEqual([{
      id: "existing", title: "Guía", description: "Texto guardado", image_url: "https://example.com/a.webp",
      url: "https://example.com/guide", badge: "Recomendado",
    }, { title: "Parcial", description: "", image_url: "", url: "", badge: "" }]);
    expect(parseRecommendations({ title: "wrong container" })).toEqual([]);
  });
});

describe("function failures", () => {
  it("reads HTTP status and server message while preserving the response body", async () => {
    const response = new Response(JSON.stringify({ error: "Espera y reintenta" }), { status: 429 });
    const error = Object.assign(new Error("Function failed"), { context: response });
    expect(errorStatus(error)).toBe(429);
    expect(await functionErrorMessage(error, "Fallback")).toBe("Espera y reintenta");
    expect(await response.json()).toEqual({ error: "Espera y reintenta" });
  });

  it("handles non-JSON responses and unknown thrown values", async () => {
    expect(await functionErrorMessage({ context: new Response("Unavailable", { status: 503 }) }, "Fallback")).toBe("Fallback");
    expect(errorMessage({ message: "Error de red" })).toBe("Error de red");
    expect(errorMessage(null)).toBe("");
    expect(errorStatus("failed")).toBeUndefined();
  });
});
