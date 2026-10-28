/**
 * Tag book/pack links so the retrieved Stripe session identifies the product.
 * Configure each Payment Link redirect with session_id={CHECKOUT_SESSION_ID};
 * a public reference or locally remembered book alone is never payment proof.
 */
export const withBookRef = (url: string, bookId?: string | null): string => {
  if (!bookId || !url || !/^https?:\/\//i.test(url)) return url || "";
  if (url.includes("client_reference_id=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}client_reference_id=book-${bookId}`;
};

const KEY = "autopilot_pending_book";
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 h

/** Remembered locally so /payment-success knows it was a book even if Stripe
 * redirects without any query parameters. */
export const rememberBookPurchase = (bookId?: string | null) => {
  if (!bookId) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: bookId, at: Date.now() }));
  } catch {
    // ignore
  }
};

export const readPendingBookRef = (): string => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { id?: string; at?: number };
    if (!parsed?.id || !parsed?.at || Date.now() - parsed.at > MAX_AGE_MS) return "";
    return `book-${parsed.id}`;
  } catch {
    return "";
  }
};

export const clearPendingBookPurchase = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
