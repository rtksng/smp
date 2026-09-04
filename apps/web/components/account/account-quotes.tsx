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
import { useState } from "react";
import {
  acceptQuoteRequest,
  convertQuoteToCart,
  convertQuoteToOrder,
  listCustomerQuoteRequests,
  isQuoteExpired,
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
  const [page, setPage] = useState(1);
  const quotesQuery = useQuery({
    queryFn: () => listCustomerQuoteRequests(page, 20),
    queryKey: customerQueryKeys.quotes(page, 20),
    staleTime: 0
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
  const isActing = acceptMutation.isPending || rejectMutation.isPending || convertMutation.isPending || orderMutation.isPending;
  function clearActionErrors() {
    acceptMutation.reset(); rejectMutation.reset(); convertMutation.reset(); orderMutation.reset();
  }

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
              label: "Latest on this page",
              value: latestQuote ? formatDate(latestQuote.createdAt) : "-"
            },
            {
              label: "Awaiting decision on this page",
              value: String(quotedCount)
            },
            {
              label: "Accepted on this page",
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
          action={<Button href="/#bulk">Request quote</Button>}
          description="Submitted bulk quote requests and itemized responses will appear here."
          title="No quote requests yet"
        />
      ) : null}

      {quotes.length > 0 ? (
        <AccountSection>
          <AccountSectionHeader
            description="Review requests matched to your account email or mobile number, then accept a quotation to continue."
            title="Quote history"
          />
          <div className="mt-4 grid gap-4">
            {quotes.map((quote) => (
              <QuoteHistoryCard
                isAccepting={acceptMutation.isPending}
                isCreatingOrder={orderMutation.isPending}
                isConverting={convertMutation.isPending}
                isRejecting={rejectMutation.isPending}
                isActing={isActing}
                key={quote.id}
                onAccept={() => { clearActionErrors(); acceptMutation.mutate(quote.id); }}
                onConvert={() => { clearActionErrors(); convertMutation.mutate(quote.id); }}
                onCreateOrder={() => { clearActionErrors(); orderMutation.mutate(quote.id); }}
                onReject={() => { clearActionErrors(); rejectMutation.mutate(quote.id); }}
                quote={quote}
              />
            ))}
          </div>
        </AccountSection>
      ) : null}
      {quotesQuery.data && quotesQuery.data.pagination.totalPages > 1 ? (
        <nav aria-label="Quote history pages" className="flex items-center justify-between gap-3">
          <Button disabled={page <= 1 || isActing} onClick={() => setPage(value => value - 1)} variant="outline">Previous</Button>
          <span>Page {page} of {quotesQuery.data.pagination.totalPages}</span>
          <Button disabled={!quotesQuery.data.pagination.hasNextPage || isActing} onClick={() => setPage(value => value + 1)} variant="outline">Next</Button>
        </nav>
      ) : null}
    </CustomerAccountShell>
  );
}

function QuoteHistoryCard({
  isAccepting,
  isCreatingOrder,
  isConverting,
  isRejecting,
  isActing,
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
  isActing: boolean;
  onAccept: () => void;
  onConvert: () => void;
  onCreateOrder: () => void;
  onReject: () => void;
  quote: QuoteRequest;
}) {
  const expired = isQuoteExpired(quote);
  const canPrepareCart =
    quote.quotation !== null &&
    quote.quotation.items.length > 0 &&
    quote.quotation.items.every((item) => item.productId);
  const canCreateOrder =
    quote.quotation !== null &&
    quote.quotation.items.length > 0 &&
    quote.quotation.items.some((item) => !item.productId);

  return (
    <article className="grid gap-4 rounded-lg border border-[#c4e4e0] bg-[#f3faf9] p-4 shadow-sm shadow-[#0f6f68]/5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e5f5f3] text-[#0f6f68]">
              <FileText aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#123f3c]">
                Quote {quote.id.slice(0, 8)}
              </h2>
              <p className="text-xs font-semibold text-[#55716e]">
                Requested {formatDate(quote.createdAt)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#55716e]">
            {quote.message}
          </p>
        </div>
        <AccountStatusBadge tone={quote.status === "REJECTED" ? "neutral" : "success"}>
          {formatQuoteStatus(quote.status)}
        </AccountStatusBadge>
      </div>

      {quote.quotation ? <QuoteSummary quote={quote} /> : null}

      {quote.customerDecision ? (
        <div className="rounded-lg border border-[#c4e4e0] bg-white p-3 text-sm font-semibold text-[#55716e]">
          Decision:{" "}
          <strong className="text-[#123f3c]">
            {formatQuoteStatus(quote.customerDecision.status)}
          </strong>{" "}
          on {formatDate(quote.customerDecision.decidedAt)}
          {quote.customerDecision.note ? ` - ${quote.customerDecision.note}` : ""}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {expired && !quote.convertedOrderId ? <p className="w-full text-sm font-semibold text-[#7a271a]">This quotation has expired. Request an updated quotation.</p> : null}
        {quote.status === "QUOTED" ? (
          <>
            <Button disabled={isActing || expired} onClick={onAccept}>
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              {isAccepting ? "Accepting..." : "Accept quote"}
            </Button>
            <Button disabled={isActing} onClick={onReject} variant="outline">
              <XCircle aria-hidden="true" className="h-4 w-4" />
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
          </>
        ) : null}

        {["ACCEPTED", "CONVERTED"].includes(quote.status) && canPrepareCart ? (
          <Button disabled={isActing || expired} onClick={onConvert} variant="secondary">
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
            disabled={isActing || expired}
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
    <div className="grid gap-4 rounded-lg border border-[#c4e4e0] bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-[#123f3c]">Quoted items</h3>
        <p className="text-xs font-semibold text-[#55716e]">
          Sent {formatDate(quotation.respondedAt)}
          {quotation.validUntil
            ? ` | Valid until ${formatDate(quotation.validUntil)}`
            : ""}
        </p>
      </div>

      <div className="grid gap-2">
        {quotation.items.map((item, index) => (
          <div
            className="grid gap-2 rounded-lg border border-[#c4e4e0] bg-[#f3faf9] p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            key={`${item.sku}-${index}`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#123f3c]">{item.name}</p>
              <p className="mt-1 text-xs font-semibold text-[#55716e]">
                SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%
              </p>
            </div>
            <strong className="text-sm text-[#123f3c]">
              {priceFormatter.format(item.lineTotal)}
            </strong>
          </div>
        ))}
      </div>

      {quotation.notes ? (
        <p className="rounded-lg bg-[#f3faf9] p-3 text-sm font-semibold leading-6 text-[#55716e]">
          {quotation.notes}
        </p>
      ) : null}

      <dl className="grid gap-2 text-sm">
        <QuoteTotalRow label="Subtotal" value={quotation.totals.subtotal} />
        <QuoteTotalRow label="Tax/GST" value={quotation.totals.taxTotal} />
        <QuoteTotalRow label="Shipping" value={quotation.totals.shippingTotal} />
        <div className="flex items-center justify-between gap-4 border-t border-[#c4e4e0] pt-3 text-base font-semibold text-[#123f3c]">
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
      <dt className="font-semibold text-[#55716e]">{label}</dt>
      <dd className="font-semibold text-[#123f3c]">{priceFormatter.format(value)}</dd>
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
