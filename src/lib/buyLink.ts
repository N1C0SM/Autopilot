/**
 * Stripe Payment Links forward `client_reference_id` (and `session_id`) to the
 * configured after-payment redirect URL. We tag book/pack buy links with
 * `client_reference_id=book-<uuid>` so /payment-success can tell a book
 * purchase apart from a subscription/plan purchase.
 */
export const withBookRef = (url: string, bookId?: string | null): string => {
  if (!bookId || !url || !/^https?:\/\//i.test(url)) return url || "";
  if (url.includes("client_reference_id=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}client_reference_id=book-${bookId}`;
};
