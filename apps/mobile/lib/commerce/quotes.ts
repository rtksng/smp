import type { QuoteRequest } from "../api/quotes";

export function isQuoteExpired(quote: QuoteRequest, now = Date.now()) {
  const value = quote.quotation?.validUntil;
  if (!value) return false;
  const expiry = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value).getTime();
  return !Number.isFinite(expiry) || expiry < now;
}

export function getQuoteActions(quote: QuoteRequest, now = Date.now()) {
  const accepted = ["ACCEPTED", "CONVERTED"].includes(quote.status);
  const items = quote.quotation?.items ?? [];
  const expired = isQuoteExpired(quote, now);
  return {
    expired,
    showDecision: quote.status === "QUOTED",
    canAccept: quote.status === "QUOTED" && !expired,
    showCart: accepted && items.length > 0 && items.every(item => item.productId) && !quote.convertedOrderId,
    showCreateOrder: accepted && items.some(item => !item.productId) && !quote.convertedOrderId,
    showOrder: accepted && Boolean(quote.convertedOrderId)
  };
}
