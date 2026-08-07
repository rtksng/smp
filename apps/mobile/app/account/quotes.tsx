import { useEffect } from "react";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { AccountInfoGrid, AccountPageHeader, AccountSection, AccountSectionHeader, AccountStatusBadge } from "@/components/account-layout";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-view";
import {
  acceptQuoteRequest,
  convertQuoteToCart,
  convertQuoteToOrder,
  listCustomerQuoteRequests,
  rejectQuoteRequest,
  type QuoteRequest
} from "@/lib/api/quotes";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatRupees, formatStatus } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

export default function QuotesScreen() {
  const { isReady, session } = useAuth();
  const queryClient = useQueryClient();
  const quotesQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => listCustomerQuoteRequests(),
    queryKey: queryKeys.quotes
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.quotes });
  const acceptMutation = useMutation({ mutationFn: acceptQuoteRequest, onSuccess: refresh });
  const rejectMutation = useMutation({ mutationFn: rejectQuoteRequest, onSuccess: refresh });
  const cartMutation = useMutation({
    mutationFn: convertQuoteToCart,
    onSuccess: async (result) => {
      queryClient.setQueryData(queryKeys.cart(), result.cart);
      await refresh();
      router.push("/cart");
    }
  });
  const orderMutation = useMutation({
    mutationFn: convertQuoteToOrder,
    onSuccess: async (result) => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: queryKeys.orders })]);
      router.push({ pathname: "/orders/[id]", params: { id: result.order.id } });
    }
  });

  useEffect(() => {
    if (isReady && !session) router.replace("/login?returnTo=/account/quotes");
  }, [isReady, session]);

  if (!isReady || (session && quotesQuery.isLoading)) {
    return <Screen><LoadingState label="Loading quotes" /></Screen>;
  }
  if (!session) return null;
  if (quotesQuery.isError || !quotesQuery.data) {
    return <Screen><ErrorState message={getErrorMessage(quotesQuery.error, "Unable to load quote requests.")} onRetry={() => quotesQuery.refetch()} /></Screen>;
  }

  const quotes = quotesQuery.data.items;
  const actionError = acceptMutation.error ?? rejectMutation.error ?? cartMutation.error ?? orderMutation.error;
  return (
    <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
      <AccountPageHeader description="Review quotation responses, accept or reject pricing, and prepare accepted catalog quotes for checkout." title="Quotes" />
      <AccountInfoGrid items={[
        { label: "Total quotes", value: String(quotesQuery.data.pagination.total) },
        { label: "Latest", value: quotes[0] ? formatDate(quotes[0].createdAt) : "-" },
        { label: "Awaiting decision", value: String(quotes.filter((quote) => quote.status === "QUOTED").length) },
        { label: "Accepted", value: String(quotes.filter((quote) => ["ACCEPTED", "CONVERTED"].includes(quote.status)).length) }
      ]} />
      {actionError ? <ErrorState message={getErrorMessage(actionError, "Unable to update this quote.")} /> : null}
      {quotes.length === 0 ? (
        <EmptyState action={<Button href="/">Request quote</Button>} description="Submitted bulk quote requests and itemized responses will appear here." title="No quote requests yet" />
      ) : (
        <AccountSection>
          <AccountSectionHeader description="Quote responses are matched to your account email and can be accepted before checkout." title="Quote history" />
          {quotes.map((quote) => (
            <QuoteCard
              busy={acceptMutation.isPending || rejectMutation.isPending || cartMutation.isPending || orderMutation.isPending}
              key={quote.id}
              onAccept={() => acceptMutation.mutate(quote.id)}
              onCart={() => cartMutation.mutate(quote.id)}
              onOrder={() => orderMutation.mutate(quote.id)}
              onReject={() => rejectMutation.mutate(quote.id)}
              quote={quote}
            />
          ))}
        </AccountSection>
      )}
    </Screen>
  );
}

function QuoteCard({ busy, onAccept, onCart, onOrder, onReject, quote }: {
  busy: boolean;
  onAccept: () => void;
  onCart: () => void;
  onOrder: () => void;
  onReject: () => void;
  quote: QuoteRequest;
}) {
  const catalogQuote = Boolean(quote.quotation?.items.length && quote.quotation.items.every((item) => item.productId));
  const manualQuote = Boolean(quote.quotation?.items.some((item) => !item.productId));
  return (
    <View style={{ backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 14, padding: 16 }}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 16 }}>Quote {quote.id.slice(0, 8)}</Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Requested {formatDate(quote.createdAt)}</Text>
        </View>
        <AccountStatusBadge label={quote.status === "QUOTED" ? "Awaiting decision" : formatStatus(quote.status)} success={quote.status !== "REJECTED"} />
      </View>
      <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 23 }}>{quote.message}</Text>
      {quote.quotation ? <QuoteSummary quote={quote} /> : null}
      {quote.customerDecision ? (
        <Text style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 20, padding: 12 }}>
          Decision: {formatStatus(quote.customerDecision.status)} on {formatDate(quote.customerDecision.decidedAt)}{quote.customerDecision.note ? ` - ${quote.customerDecision.note}` : ""}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {quote.status === "QUOTED" ? <><Button disabled={busy} onPress={onAccept}>Accept quote</Button><Button disabled={busy} onPress={onReject} variant="outline">Reject</Button></> : null}
        {["ACCEPTED", "CONVERTED"].includes(quote.status) && catalogQuote ? <Button disabled={busy} onPress={onCart} variant="soft">Prepare cart</Button> : null}
        {["ACCEPTED", "CONVERTED"].includes(quote.status) && manualQuote && quote.convertedOrderId ? <Button href={{ pathname: "/orders/[id]", params: { id: quote.convertedOrderId } }} variant="soft">View order</Button> : null}
        {["ACCEPTED", "CONVERTED"].includes(quote.status) && manualQuote && !quote.convertedOrderId ? <Button disabled={busy} onPress={onOrder} variant="soft">Create order</Button> : null}
      </View>
    </View>
  );
}

function QuoteSummary({ quote }: { quote: QuoteRequest }) {
  const quotation = quote.quotation;
  if (!quotation) return null;
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 12, padding: 14 }}>
      <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 14 }}>Quoted items</Text>
      <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Sent {formatDate(quotation.respondedAt)}{quotation.validUntil ? ` | Valid until ${formatDate(quotation.validUntil)}` : ""}</Text>
      {quotation.items.map((item, index) => (
        <View key={`${item.sku}-${index}`} style={{ backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 5, padding: 12 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{item.name}</Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 14 }}>{formatRupees(item.lineTotal)}</Text>
        </View>
      ))}
      {quotation.notes ? <Text style={{ backgroundColor: colors.background, borderRadius: 8, color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 21, padding: 12 }}>{quotation.notes}</Text> : null}
      <QuoteTotal label="Subtotal" value={quotation.totals.subtotal} />
      <QuoteTotal label="Tax/GST" value={quotation.totals.taxTotal} />
      <QuoteTotal label="Shipping" value={quotation.totals.shippingTotal} />
      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 10 }}><QuoteTotal label="Total" value={quotation.totals.grandTotal} /></View>
    </View>
  );
}

function QuoteTotal({ label, value }: { label: string; value: number }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13 }}>{label}</Text><Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 13 }}>{formatRupees(value)}</Text></View>;
}
