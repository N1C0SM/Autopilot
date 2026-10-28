const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const bookIdFromReference = (value: string): string | null =>
  value.startsWith("book-") && UUID_RE.test(value.slice(5)) ? value.slice(5) : null;

export const normalizeBookPaymentUrl = (value: string | null | undefined): string => {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && url.hostname === "buy.stripe.com" && !url.username && !url.password
      ? `${url.origin}${url.pathname.replace(/\/$/, "")}` : "";
  } catch { return ""; }
};

type BookPaymentSession = {
  id: string;
  mode: string | null;
  status: string | null;
  payment_status: string;
  livemode: boolean;
  client_reference_id: string | null;
};

/** Only a retrieved paid session and its actual product link prove a purchase.
 * The public book reference and local browser storage are never payment proof. */
export const bookPaymentMatches = (
  session: BookPaymentSession,
  mode: "live" | "test",
  bookId: string,
  requestedRef: string,
  paymentLinkUrl: string,
  configuredUrls: Array<string | null | undefined>,
): boolean => {
  if (!session.id.startsWith("cs_") || session.id.length <= 3 || session.mode !== "payment"
    || session.status !== "complete" || session.payment_status !== "paid"
    || session.livemode !== (mode === "live")) return false;
  const expectedRef = `book-${bookId}`;
  if (!bookIdFromReference(expectedRef) || (requestedRef && requestedRef !== expectedRef)
    || (session.client_reference_id && session.client_reference_id !== expectedRef)) return false;
  if (!session.client_reference_id && !requestedRef) return false;
  const actualUrl = normalizeBookPaymentUrl(paymentLinkUrl);
  return !!actualUrl && configuredUrls.some((url) => normalizeBookPaymentUrl(url) === actualUrl);
};
