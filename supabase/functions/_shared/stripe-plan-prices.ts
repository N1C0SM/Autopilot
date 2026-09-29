interface PaymentLinkClient {
  paymentLinks: {
    list(params: { limit: number }): AsyncIterable<{ id: string; url: string }>;
    listLineItems(id: string, params: { limit: number }): Promise<{ data: Array<{ price: { id: string; recurring?: unknown } | null }> }>;
  };
}

/** Derive missing prices only from the merchant's configured Stripe payment links. */
export async function loadPlanPrices(stripe: PaymentLinkClient, settings: Record<string, unknown>, mode: "test" | "live") {
  const prices = { ...settings };
  const missing = ["training", "full", "transform"].filter(tier =>
    !prices[`price_id_${tier}_${mode}`] && typeof settings[`payment_link_${tier}_${mode}`] === "string" && settings[`payment_link_${tier}_${mode}`]);
  if (!missing.length) return prices;
  const normalized = (url: string) => new URL(url).origin + new URL(url).pathname.replace(/\/$/, "");
  const targets = new Map(missing.map(tier => [normalized(String(settings[`payment_link_${tier}_${mode}`])), tier]));
  for await (const link of stripe.paymentLinks.list({ limit: 100 })) {
    const tier = targets.get(normalized(link.url));
    if (!tier) continue;
    const items = await stripe.paymentLinks.listLineItems(link.id, { limit: 100 });
    // Multi-product links are ambiguous; do not guess which purchase grants coaching.
    if (items.data.length === 1 && items.data[0].price?.recurring) {
      prices[`price_id_${tier}_${mode}`] = items.data[0].price.id;
    }
    targets.delete(normalized(link.url));
    if (!targets.size) break;
  }
  return prices;
}
