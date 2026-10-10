/** Object members received as JSON must be narrowed before the UI uses them. */
export const jsonObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const jsonString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error !== null && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "";
};

export const errorStatus = (error: unknown): number | undefined => {
  const context = jsonObject(jsonObject(error).context);
  return typeof context.status === "number" ? context.status : undefined;
};

/** Edge function HTTP failures can contain the useful message in their response. */
export const functionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  if (error !== null && typeof error === "object" && "context" in error && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      const message = jsonObject(body).error;
      if (typeof message === "string" && message) return message;
    } catch { /* A non-JSON error response falls back to the caller's message. */ }
  }
  return fallback;
};
