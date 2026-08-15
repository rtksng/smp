import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "@/components/ui/state-view";
import {
  getCart,
  removeCartItem,
  updateCartItem
} from "@/lib/api/cart";
import type { CartItem } from "@/lib/api/schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatRupees } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function CartScreen() {
  const { isReady, session } = useAuth();
  const queryClient = useQueryClient();
  const cartQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => getCart(),
    queryKey: queryKeys.cart()
  });
  const updateMutation = useMutation({
    mutationFn: ({
      itemId,
      quantity
    }: {
      itemId: string;
      quantity: number;
    }) => updateCartItem(itemId, quantity),
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart(), cart)
  });
  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart(), cart)
  });

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login?returnTo=/cart");
    }
  }, [isReady, session]);

  if (isReady && !session) {
    return null;
  }

  if (!isReady || cartQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading your cart" />
      </Screen>
    );
  }

  if (cartQuery.isError) {
    return (
      <Screen>
        <ErrorState
          message={getErrorMessage(cartQuery.error, "Unable to load cart.")}
          onRetry={() => void cartQuery.refetch()}
          title="Unable to load cart"
        />
      </Screen>
    );
  }

  const cart = cartQuery.data;
  const hasBlockingStockIssue =
    cart?.items.some(
      (item) => !item.isAvailable || item.quantity > item.availableQuantity
    ) ?? false;
  const isMutating = updateMutation.isPending || removeMutation.isPending;

  if (!cart || cart.items.length === 0) {
    return (
      <Screen>
        <EmptyState
          action={<Button href="/search">Continue shopping</Button>}
          description="Add verified medical products before checkout."
          title="Your cart is empty"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {cart.items.map((item) => (
        <CartItemCard
          isRemoving={removeMutation.isPending && removeMutation.variables === item.id}
          isUpdating={
            updateMutation.isPending && updateMutation.variables?.itemId === item.id
          }
          item={item}
          key={item.id}
          onRemove={() => removeMutation.mutate(item.id)}
          onUpdate={(quantity) =>
            updateMutation.mutate({ itemId: item.id, quantity })
          }
        />
      ))}
      {updateMutation.error || removeMutation.error ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={{
            backgroundColor: colors.dangerBackground,
            borderRadius: 10,
            color: colors.danger,
            fontFamily: fonts.bodySemiBold,
            padding: 12
          }}
        >
          {getErrorMessage(
            updateMutation.error ?? removeMutation.error,
            "Unable to update cart."
          )}
        </Text>
      ) : null}
      <View style={{ ...cardStyle, borderRadius: 8, gap: 12, padding: 20 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 40, justifyContent: "center", width: 40 }}>
            <MaterialCommunityIcons color={colors.primaryDark} name="shopping-outline" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.ink, fontFamily: fonts.heading, fontSize: 18 }}>Price summary</Text>
            <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
              {cart.totalQuantity} item{cart.totalQuantity === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
        <SummaryRow label="Subtotal" value={cart.totals.subtotal} />
        <SummaryRow label="Discount" value={-cart.totals.discount} />
        <SummaryRow label="Delivery charge" value={cart.totals.deliveryCharge} />
        <SummaryRow label="Tax/GST" value={cart.totals.tax} />
        <View
          style={{
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingTop: 12
          }}
        >
          <SummaryRow label="Grand total" strong value={cart.totals.grandTotal} />
        </View>
        {hasBlockingStockIssue ? (
          <Text accessibilityRole="alert" selectable style={{ backgroundColor: colors.dangerBackground, borderRadius: 8, color: "#7A271A", fontFamily: fonts.bodySemiBold, fontSize: 14, padding: 12 }}>
            Resolve stock warnings to continue checkout.
          </Text>
        ) : null}
        <Button disabled={hasBlockingStockIssue || isMutating} href="/checkout">Proceed to checkout</Button>
        <Button href="/search" variant="outline">
          Continue shopping
        </Button>
      </View>
    </Screen>
  );
}

function CartItemCard({
  isRemoving,
  isUpdating,
  item,
  onRemove,
  onUpdate
}: {
  isRemoving: boolean;
  isUpdating: boolean;
  item: CartItem;
  onRemove: () => void;
  onUpdate: (quantity: number) => void;
}) {
  return (
    <View style={{ ...cardStyle, borderRadius: 8, gap: 12, padding: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: 10,
            borderWidth: 1,
            height: 96,
            justifyContent: "center",
            overflow: "hidden",
            width: 96
          }}
        >
          {item.imageUrl ? (
            <Image
              accessibilityLabel={item.name}
              contentFit="cover"
              source={{ uri: item.imageUrl }}
              style={{ height: "100%", width: "100%" }}
            />
          ) : (
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="medical-bag"
              size={34}
            />
          )}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Text selectable style={{ color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 11 }}>{item.brand.name}</Text>
            <Text selectable style={{ color: "#9CAFAC", fontFamily: fonts.bodySemiBold, fontSize: 11 }}>/</Text>
            <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 11 }}>{item.category.name}</Text>
          </View>
          <Text
            numberOfLines={2}
            selectable
            style={{
              color: colors.ink,
              fontFamily: fonts.heading,
              fontSize: 14,
              lineHeight: 20
            }}
          >
            {item.name}
          </Text>
          <Text selectable style={{ alignSelf: "flex-start", backgroundColor: colors.surfaceMuted, borderRadius: 8, color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 4 }}>SKU {item.sku}</Text>
        </View>
        <Pressable
          accessibilityLabel={`Remove ${item.name}`}
          accessibilityRole="button"
          disabled={isRemoving}
          hitSlop={6}
          onPress={onRemove}
          style={{
            alignItems: "center",
            borderColor: "#F4C7C3",
            borderRadius: 18,
            borderWidth: 1,
            height: 34,
            justifyContent: "center",
            opacity: isRemoving ? 0.5 : 1,
            width: 34
          }}
        >
          <MaterialCommunityIcons
            color={colors.danger}
            name="trash-can-outline"
            size={18}
          />
        </Pressable>
      </View>
      {!item.isAvailable ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={{
            backgroundColor: colors.dangerBackground,
            borderRadius: 8,
            color: colors.danger,
            fontFamily: fonts.bodySemiBold,
            fontSize: 12,
            padding: 10
          }}
        >
          This item is unavailable. Remove it before checkout.
        </Text>
      ) : null}
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between"
        }}
      >
        <Text
          selectable
          style={{
            color: colors.text,
            fontFamily: fonts.bodySemiBold,
            fontSize: 12
          }}
        >
          Quantity
        </Text>
        <View
          style={{
            alignItems: "center",
            borderColor: "#CBDEDB",
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: "row",
            opacity: isUpdating ? 0.55 : 1
          }}
        >
          <Pressable
            accessibilityLabel={`Decrease ${item.name} quantity`}
            accessibilityRole="button"
            disabled={isUpdating || item.quantity <= 1}
            onPress={() => onUpdate(item.quantity - 1)}
            style={{
              alignItems: "center",
              height: 44,
              justifyContent: "center",
              width: 44
            }}
          >
            <MaterialCommunityIcons color={colors.text} name="minus" size={17} />
          </Pressable>
          <Text
            selectable
            style={{
              color: colors.ink,
              fontFamily: fonts.bodySemiBold,
              fontVariant: ["tabular-nums"],
              minWidth: 38,
              textAlign: "center"
            }}
          >
            {item.quantity}
          </Text>
          <Pressable
            accessibilityLabel={`Increase ${item.name} quantity`}
            accessibilityRole="button"
            disabled={
              isUpdating || item.quantity >= Math.min(item.availableQuantity, 999)
            }
            onPress={() => onUpdate(item.quantity + 1)}
            style={{
              alignItems: "center",
              height: 44,
              justifyContent: "center",
              width: 44
            }}
          >
            <MaterialCommunityIcons color={colors.text} name="plus" size={17} />
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <CartMetric label="Unit" value={formatRupees(item.unitPrice)} />
        <CartMetric label="Tax" value={formatRupees(item.tax)} />
        <CartMetric label="Total" value={formatRupees(item.total)} />
      </View>
    </View>
  );
}

function CartMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, gap: 2, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 10, textTransform: "uppercase" }}>{label}</Text>
      <Text selectable style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{value}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  strong = false,
  value
}: {
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between"
      }}
    >
      <Text
        selectable
        style={{
          color: strong ? colors.ink : colors.muted,
          fontFamily: strong ? fonts.heading : fonts.bodySemiBold,
          fontSize: strong ? 16 : 13
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: strong ? colors.ink : colors.text,
          fontFamily: strong ? fonts.headingBold : fonts.bodySemiBold,
          fontSize: strong ? 17 : 13,
          fontVariant: ["tabular-nums"]
        }}
      >
        {formatRupees(value)}
      </Text>
    </View>
  );
}
