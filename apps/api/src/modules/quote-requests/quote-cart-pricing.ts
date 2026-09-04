import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";

type CartLine = { productId: string; variantId: string | null; quantity: number };
export type QuotePriceLine = CartLine & { unitPrice: number; taxRate: number };

/** Prices come only from an accepted server-side quotation associated with this cart. */
export async function getCartQuotePricing(
  client: Pick<Prisma.TransactionClient, "notificationLog">,
  cart: { id: string; items: CartLine[] }
) {
  if (!cart.items.length) return null;
  const record = await client.notificationLog.findFirst({
    where: {
      channel: "support",
      templateKey: "bulk_quote_request",
      status: { in: ["CONVERTED", "CLOSED"] },
      payload: { path: ["convertedCartId"], equals: cart.id }
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
  });
  if (!record?.payload || typeof record.payload !== "object") return null;
  const payload = record.payload as unknown as {
    customerDecision?: { status?: string };
    quotation?: { items: QuotePriceLine[]; validUntil: string | null; totals: { shippingTotal: number } };
  };
  const quotation = payload.quotation;
  if (payload.customerDecision?.status !== "ACCEPTED" || !quotation?.items?.length) return null;
  if (quotation.items.length !== cart.items.length) return null;
  const lines = new Map(quotation.items.map(item => [quoteLineKey(item), item]));
  if (lines.size !== cart.items.length || cart.items.some(item => lines.get(quoteLineKey(item))?.quantity !== item.quantity)) return null;
  assertQuotationIsCurrent(quotation);
  return { lines, record, shippingTotal: quotation.totals.shippingTotal };
}

export async function clearCartQuotePricing(client: Pick<Prisma.TransactionClient, "notificationLog">, cartId: string, preservedQuoteId?: string) {
  const records = await client.notificationLog.findMany({ where: {
    channel: "support", templateKey: "bulk_quote_request",
    payload: { path: ["convertedCartId"], equals: cartId }
  } });
  for (const record of records) {
    if (preservedQuoteId && record.id === preservedQuoteId) continue;
    await updateCartQuoteLink(client, record, null);
  }
}

export async function updateCartQuoteLink(
  client: Pick<Prisma.TransactionClient, "notificationLog">,
  record: Prisma.NotificationLogGetPayload<Record<string, never>>,
  orderId: string | null
) {
  const payload = record.payload as Prisma.JsonObject;
  const updated = await client.notificationLog.updateMany({
    where: { id: record.id, updatedAt: record.updatedAt },
    data: { payload: { ...payload, convertedCartId: null, ...(orderId ? { convertedOrderId: orderId } : {}) } as Prisma.InputJsonValue }
  });
  if (updated.count !== 1) throw new BadRequestException("The quotation changed. Refresh your cart and try again.");
}

export function quoteLineKey(item: { productId: string | null; variantId: string | null }) {
  return `${item.productId}:${item.variantId ?? "base"}`;
}

export function assertQuotationIsCurrent(quotation: { validUntil: string | null }) {
  if (!quotation.validUntil) return;
  const value = quotation.validUntil;
  const deadline = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value).getTime();
  if (!Number.isFinite(deadline) || deadline < Date.now()) {
    throw new BadRequestException("This quotation has expired. Request an updated quotation.");
  }
}
