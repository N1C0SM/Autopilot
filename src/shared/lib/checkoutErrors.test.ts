import { describe, expect, it } from "vitest";
import { checkoutErrorMessage, describeCheckoutError } from "@/shared/lib/checkoutErrors";

// Mismo formato que lanza supabase-js: nombre FunctionsHttpError y contexto Response.
const httpError = (status: number, body?: unknown) => ({
  name: "FunctionsHttpError",
  message: "Edge Function returned a non-2xx status code",
  context: new Response(body === undefined ? null : JSON.stringify(body), { status }),
});

describe("errores de create-checkout", () => {
  it("explica que falta configurar el enlace de pago (no_price)", async () => {
    const error = httpError(400, { code: "no_price", error: "Payment link no configurado" });
    const issue = await describeCheckoutError(error, null);
    expect(issue.code).toBe("no_price");
    expect(issue.message).toMatch(/aún no está configurado/i);
    expect(issue.retryable).toBe(false);
  });

  it("explica la campaña gratuita (free_campaign)", async () => {
    expect(await checkoutErrorMessage(httpError(403, { code: "free_campaign" }))).toMatch(/campaña gratuita/i);
  });

  it("no culpa al usuario de un plan desconocido (unknown_plan)", async () => {
    const message = await checkoutErrorMessage(httpError(400, { code: "unknown_plan" }));
    expect(message).toMatch(/ya no está disponible/i);
    expect(message).toMatch(/elige otro/i);
  });

  it("acepta el código en el campo error y también en data", async () => {
    expect((await describeCheckoutError(httpError(400, { error: "unknown_plan" }))).code).toBe("unknown_plan");
    expect((await describeCheckoutError(null, { code: "no_price" })).code).toBe("no_price");
  });

  it("explica el límite de intentos (429 sin cuerpo)", async () => {
    const issue = await describeCheckoutError(httpError(429));
    expect(issue.code).toBe("rate_limited");
    expect(issue.message).toMatch(/espera un minuto/i);
    expect(issue.retryable).toBe(true);
  });

  it("distingue un fallo de red o timeout y deja reintentar", async () => {
    const network = await describeCheckoutError(new TypeError("Failed to fetch"));
    expect(network.code).toBe("network");
    expect(network.message).toMatch(/conexión/i);
    expect(network.retryable).toBe(true);

    const fetchError = { name: "FunctionsFetchError", message: "Failed to send a request to the Edge Function" };
    expect((await describeCheckoutError(fetchError)).code).toBe("network");

    const abort = { name: "AbortError", message: "The operation was aborted." };
    expect((await describeCheckoutError(abort)).code).toBe("network");
  });

  it("trata una caída del servicio (5xx) como temporal", async () => {
    const issue = await describeCheckoutError(httpError(500, "boom"));
    expect(issue.code).toBe("unavailable");
    expect(issue.retryable).toBe(true);
  });

  it("pide iniciar sesión si el token caducó (401)", async () => {
    const issue = await describeCheckoutError(httpError(401));
    expect(issue.code).toBe("session");
    expect(issue.message).toMatch(/iniciar sesión/i);
  });

  it("usa un mensaje genérico accionable cuando no hay más información", async () => {
    const message = await checkoutErrorMessage(null, null);
    expect(message).toMatch(/No se pudo iniciar el pago/i);
    expect(message).toMatch(/escríbenos por el chat/i);
  });

  it("no expone mensajes técnicos del servidor", async () => {
    const message = await checkoutErrorMessage(httpError(400, { error: "stack trace: stripe key null" }), null);
    expect(message).not.toMatch(/stripe|stack/i);
    expect(message).toBe("No se pudo iniciar el pago. Inténtalo de nuevo y, si sigue fallando, escríbenos por el chat.");
  });
});
