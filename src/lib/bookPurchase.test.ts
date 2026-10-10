import { describe, expect, it } from "vitest";
import { bookIdFromReference, bookPaymentMatches } from "../../supabase/functions/_shared/book-purchase";

const bookId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const ref = `book-${bookId}`;
const link = "https://buy.stripe.com/test_correct";
const paid = { id: "cs_test_private", mode: "payment", status: "complete", payment_status: "paid", livemode: false, client_reference_id: ref };
const matches = (session = paid, requestedRef = ref, actualLink = link, configured = [link]) =>
  bookPaymentMatches(session, "test", bookId, requestedRef, actualLink, configured);

describe("book download payment proof", () => {
  it("accepts a paid session for the configured book link", () => {
    expect(matches()).toBe(true);
  });

  it.each([
    { mode: "subscription" }, { status: "open" }, { payment_status: "unpaid" },
    { livemode: true }, { id: "" },
  ])("rejects an incomplete, unrelated or wrong-environment payment: %j", (change) => {
    expect(matches({ ...paid, ...change })).toBe(false);
  });

  it("does not grant another book when the public reference is forged", () => {
    expect(matches({ ...paid, client_reference_id: `book-${otherId}` })).toBe(false);
    expect(matches(paid, `book-${otherId}`)).toBe(false);
    expect(matches(paid, ref, "https://buy.stripe.com/test_cheaper_book")).toBe(false);
  });

  it("allows a legacy session without a reference only with its actual matching product link", () => {
    expect(matches({ ...paid, client_reference_id: "" })).toBe(true);
    expect(matches({ ...paid, client_reference_id: "" }, "")).toBe(false);
    expect(matches({ ...paid, client_reference_id: "" }, ref, "https://buy.stripe.com/test_other")).toBe(false);
  });

  it("ignores tracking parameters but rejects non-Stripe or missing links", () => {
    expect(matches(paid, ref, `${link}?utm_source=test`, [`${link}/?client_reference_id=${ref}`])).toBe(true);
    expect(matches(paid, ref, "https://buy.stripe.com.evil.example/test_correct")).toBe(false);
    expect(matches(paid, ref, link, [])).toBe(false);
  });

  it("validates book references before selecting a product", () => {
    expect(bookIdFromReference(ref)).toBe(bookId);
    expect(bookIdFromReference("book-arbitrary")).toBeNull();
  });
});
