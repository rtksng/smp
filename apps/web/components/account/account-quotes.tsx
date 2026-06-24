"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  ReceiptText,
  ShoppingCart,
  XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  acceptQuoteRequest,
  convertQuoteToCart,
  convertQuoteToOrder,
  listCustomerQuoteRequests,
  rejectQuoteRequest,
  type QuoteRequest
} from "../../lib/api/quote-requests";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { useCartStore } from "../../lib/stores/cart-store";
import { Button } from "../ui/button";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Skeleton } from "../ui/skeleton";
import {
  AccountInfoGrid,
  AccountSection,
  AccountSectionHeader,
  AccountStatusBadge,
  CustomerAccountShell,
  PrivateEmptyState
} from "./customer-account-shell";

const priceFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

export function AccountQuotes() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setCartSummary = useCartStore((state) => state.setSummary);
  const quotesQuery = useQuery({
    queryFn: () => listCustomerQuoteRequests(),
    queryKey: customerQueryKeys.quotes(1, 20)
  });
  const quotes = quotesQuery.data?.items ?? [];
  const latestQuote = quotes[0];
  const quotedCount = quotes.filter((quote) => quote.status === "QUOTED").length;
  const acceptedCount = quotes.filter((quote) =>
    ["ACCEPTED", "CONVERTED"].includes(quote.status)
  ).length;
  const acceptMutation = useMutation({
    mutationFn: (quoteId: string) => acceptQuoteRequest(quoteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-quotes"] })
  });
  const rejectMutation = useMutation({
    mutationFn: (quoteId: string) => rejectQuoteRequest(quoteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-quotes"] })
  });
  const convertMutation = useMutation({
    mutationFn: (quoteId: string) => convertQuoteToCart(quoteId),
    onSuccess: (result) => {
      setCartSummary(result.cart);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["customer-quotes"] });
      router.push("/cart");
    }
  });
  const orderMutation = useMutation({
    mutationFn: (quoteId: string) => convertQuoteToOrder(quoteId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer-quotes"] });
      router.push(`/account/orders/${result.order.id}`);
    }
  });
  const actionError =
    getFriendlyApiErrorMessage(acceptMutation.error, "") ||
    getFriendlyApiErrorMessage(rejectMutation.error, "") ||
    getFriendlyApiErrorMessage(convertMutation.error, "") ||
    getFriendlyApiErrorMessage(orderMutation.error, "");

  return (
    <CustomerAccountShell
      activePath="/account/quotes"
      description="Review quotation responses, accept or reject pricing, and prepare accepted catalog quotes for checkout."
      title="Quotes"
    >
      {quotesQuery.isLoading ? <QuotesSkeleton /> : null}

      {quotesQuery.isError ? (
        <ErrorState
          action={<RetryButton onRetry={() => quotesQuery.refetch()} />}
          message={getFriendlyApiErrorMessage(
            quotesQuery.error,
            "Unable to load quote requests."
          )}
          title="Unable to load quotes"
        />
      ) : null}

      {quotesQuery.isSuccess ? (
        <AccountInfoGrid
          items={[
            {
              label: "Total quotes",
              value: String(quotesQuery.data.pagination.total)
            },
            {
              label: "Latest",
              value: latestQuote ? formatDate(latestQuote.createdAt) : "-"
            },
            {
              label: "Awaiting decision",
              value: String(quotedCount)
            },
            {
              label: "Accepted",
              value: String(acceptedCount)
            }
          ]}
        />
      ) : null}

      {actionError ? (
        <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#7a271a]">
          {actionError}
        </p>
      ) : null}

      {quotesQuery.isSuccess && quotes.length === 0 ? (
        <PrivateEmptyState
          action={<Button href="/#bulk-quote">Request quote</Button>}
          description="Submitted bulk quote requests and itemized responses will appear here."
          title="No quote requests yet"
        />
      ) : null}

      {quotes.length > 0 ? (
        <AccountSection>
          <AccountSectionHeader
            description="Quote responses are matched to your account email and can be accepted before checkout."
            title="Quote history"
          />
          <div className="mt-4 grid gap-4">
            {quotes.map((quote) => (
              <QuoteHistoryCard
                isAccepting={acceptMutation.isPending}
                isCreatingOrder={orderMutation.isPending}
                isConverting={convertMutation.isPending}
                isRejecting={rejectMutation.isPending}
                key={quote.id}
                onAccept={() => acceptMutation.mutate(quote.id)}
                onConvert={() => convertMutation.mutate(quote.id)}
                onCreateOrder={() => orderMutation.mutate(quote.id)}
                onReject={() => rejectMutation.mutate(quote.id)}
                quote={quote}
              />
            ))}
          </div>
        </AccountSection>
      ) : null}
    </CustomerAccountShell>
  );
}

function QuoteHistoryCard({
  isAccepting,
  isCreatingOrder,
  isConverting,
  isRejecting,
  onAccept,
  onConvert,
  onCreateOrder,
  onReject,
  quote
}: {
  isAccepting: boolean;
  isCreatingOrder: boolean;
  isConverting: boolean;
  isRejecting: boolean;
  onAccept: () => void;
  onConvert: () => void;
  onCreateOrder: () => void;
  onReject: () => void;
  quote: QuoteRequest;
}) {
  const canPrepareCart =
    quote.quotation !== null &&
    quote.quotation.items.length > 0 &&
    quote.quotation.items.every((item) => item.productId);
  const canCreateOrder =
    quote.quotation !== null &&
    quote.quotation.items.length > 0 &&
    quote.quotation.items.some((item) => !item.productId);

  return (
    <article className="grid gap-4 rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-4 shadow-sm shadow-[#287c30]/5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eaf7eb] text-[#287c30]">
              <FileText aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#173b1d]">
                Quote {quote.id.slice(0, 8)}
              </h2>
              <p className="text-xs font-semibold text-[#556b57]">
                Requested {formatDate(quote.createdAt)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#556b57]">
            {quote.message}
          </p>
        </div>
        <AccountStatusBadge tone={quote.status === "REJECTED" ? "neutral" : "success"}>
          {formatQuoteStatus(quote.status)}
        </AccountStatusBadge>
      </div>

      {quote.quotation ? <QuoteSummary quote={quote} /> : null}

      {quote.customerDecision ? (
        <div className="rounded-lg border border-[#cfe9d2] bg-white p-3 text-sm font-semibold text-[#556b57]">
          Decision:{" "}
          <strong className="text-[#173b1d]">
            {formatQuoteStatus(quote.customerDecision.status)}
          </strong>{" "}
          on {formatDate(quote.customerDecision.decidedAt)}
          {quote.customerDecision.note ? ` - ${quote.customerDecision.note}` : ""}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {quote.status === "QUOTED" ? (
          <>
            <Button disabled={isAccepting} onClick={onAccept}>
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              {isAccepting ? "Accepting..." : "Accept quote"}
            </Button>
            <Button disabled={isRejecting} onClick={onReject} variant="outline">
              <XCircle aria-hidden="true" className="h-4 w-4" />
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
          </>
        ) : null}

        {["ACCEPTED", "CONVERTED"].includes(quote.status) && canPrepareCart ? (
          <Button disabled={isConverting} onClick={onConvert} variant="secondary">
            <ShoppingCart aria-hidden="true" className="h-4 w-4" />
            {isConverting ? "Preparing cart..." : "Prepare cart"}
          </Button>
        ) : null}

        {["ACCEPTED", "CONVERTED"].includes(quote.status) &&
        canCreateOrder &&
        quote.convertedOrderId ? (
          <Button
            href={`/account/orders/${encodeURIComponent(quote.convertedOrderId)}`}
            variant="secondary"
          >
            <ReceiptText aria-hidden="true" className="h-4 w-4" />
            View order
          </Button>
        ) : null}

        {["ACCEPTED", "CONVERTED"].includes(quote.status) &&
        canCreateOrder &&
        !quote.convertedOrderId ? (
          <Button
            disabled={isCreatingOrder}
            onClick={onCreateOrder}
            variant="secondary"
          >
            <ReceiptText aria-hidden="true" className="h-4 w-4" />
            {isCreatingOrder ? "Creating order..." : "Create order"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function QuoteSummary({ quote }: { quote: QuoteRequest }) {
  const quotation = quote.quotation;

  if (!quotation) {
    return null;
  }

  return (
    <div className="grid gap-4 rounded-lg border border-[#cfe9d2] bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-[#173b1d]">Quoted items</h3>
        <p className="text-xs font-semibold text-[#556b57]">
          Sent {formatDate(quotation.respondedAt)}
          {quotation.validUntil
            ? ` | Valid until ${formatDate(quotation.validUntil)}`
            : ""}
        </p>
      </div>

      <div className="grid gap-2">
        {quotation.items.map((item, index) => (
          <div
            className="grid gap-2 rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            key={`${item.sku}-${index}`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#173b1d]">{item.name}</p>
              <p className="mt-1 text-xs font-semibold text-[#556b57]">
                SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%
              </p>
            </div>
            <strong className="text-sm text-[#173b1d]">
              {priceFormatter.format(item.lineTotal)}
            </strong>
          </div>
        ))}
      </div>

      {quotation.notes ? (
        <p className="rounded-lg bg-[#f4fbf5] p-3 text-sm font-semibold leading-6 text-[#556b57]">
          {quotation.notes}
        </p>
      ) : null}

      <dl className="grid gap-2 text-sm">
        <QuoteTotalRow label="Subtotal" value={quotation.totals.subtotal} />
        <QuoteTotalRow label="Tax/GST" value={quotation.totals.taxTotal} />
        <QuoteTotalRow label="Shipping" value={quotation.totals.shippingTotal} />
        <div className="flex items-center justify-between gap-4 border-t border-[#cfe9d2] pt-3 text-base font-semibold text-[#173b1d]">
          <dt>Total</dt>
          <dd>{priceFormatter.format(quotation.totals.grandTotal)}</dd>
        </div>
      </dl>
    </div>
  );
}

function QuoteTotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-semibold text-[#556b57]">{label}</dt>
      <dd className="font-semibold text-[#173b1d]">{priceFormatter.format(value)}</dd>
    </div>
  );
}

function QuotesSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-20" key={index} />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatQuoteStatus(value: string) {
  if (value === "QUOTED") {
    return "Awaiting decision";
  }

  if (value === "CONVERTED") {
    return "Converted";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
