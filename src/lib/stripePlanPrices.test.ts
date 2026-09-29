import { expect, it } from "vitest";
import { loadPlanPrices } from "../../supabase/functions/_shared/stripe-plan-prices";

it("resolves the configured payment link only, including retired links with current subscribers", async () => {
  const stripe = { paymentLinks: {
    async *list() {
      yield { id: "other", url: "https://buy.stripe.com/other" };
      yield { id: "training", url: "https://buy.stripe.com/training", active: false };
    },
    async listLineItems(id: string) { return { data: [{ price: { id: `price_${id}`, recurring: { interval: "month" } } }] }; },
  }};
  const original = { payment_link_training_test: "https://buy.stripe.com/training?prefilled_email=x" };
  const prices = await loadPlanPrices(stripe as never, original, "test");
  expect(prices.price_id_training_test).toBe("price_training");
  expect(prices.price_id_full_test).toBeUndefined();
  expect(original).not.toHaveProperty("price_id_training_test");
});
it("does not infer a coaching price from a multi-product or one-off purchase", async () => {
  for (const items of [[{ price: { id: "book", recurring: null } }], [{ price: { id: "a", recurring: {} } }, { price: { id: "b", recurring: {} } }]]) {
    const stripe = { paymentLinks: { async *list() { yield { id: "link", url: "https://buy.stripe.com/link" }; }, async listLineItems() { return { data: items }; } } };
    const prices = await loadPlanPrices(stripe as never, { payment_link_full_test: "https://buy.stripe.com/link" }, "test");
    expect(prices.price_id_full_test).toBeUndefined();
  }
});
