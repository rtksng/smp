import { describe, expect, it } from "vitest";
import { quoteFixture } from "../testing/commerce-fixtures";
import { getQuoteActions, isQuoteExpired } from "./quotes";

describe("quotation actions", () => {
  it("expires date-only quotations at the end of the day and rejects malformed expiry dates", () => {
    const quote = quoteFixture();
    quote.quotation!.validUntil = "2026-09-04";
    expect(isQuoteExpired(quote, Date.parse("2026-09-04T23:59:59.999Z"))).toBe(false);
    expect(isQuoteExpired(quote, Date.parse("2026-09-05T00:00:00.000Z"))).toBe(true);
    quote.quotation!.validUntil = "not-a-date";
    expect(getQuoteActions(quote).canAccept).toBe(false);
    expect(getQuoteActions(quote).showDecision).toBe(true);
  });

  it("distinguishes catalog carts, custom orders, existing orders and closed requests", () => {
    const quote = quoteFixture({ status: "ACCEPTED" });
    expect(getQuoteActions(quote)).toMatchObject({ showCart: true, showCreateOrder: false, showOrder: false });
    quote.quotation!.items[0]!.productId = null;
    expect(getQuoteActions(quote)).toMatchObject({ showCart: false, showCreateOrder: true });
    quote.quotation!.items[0]!.productId = "product-1";
    quote.convertedOrderId = "order-1";
    quote.status = "CONVERTED";
    expect(getQuoteActions(quote)).toMatchObject({ showCart: false, showCreateOrder: false, showOrder: true });
    quote.status = "CLOSED";
    expect(getQuoteActions(quote)).toMatchObject({ showDecision: false, showCart: false, showCreateOrder: false });
  });
});
