import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { listAvailableCoupons, type AvailableCoupon } from "@/lib/api/coupons";
import { getAvailableCouponState } from "@/lib/commerce/coupons";
import { formatDate, formatRupees } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

type CouponProps = {
  appliedCode: string | null;
  disabled: boolean;
  onApply: (code: string) => void;
  subtotal: number;
};

export function AvailableCoupons(props: CouponProps) {
  const couponsQuery = useQuery({
    queryFn: listAvailableCoupons,
    queryKey: queryKeys.availableCoupons,
    retry: false,
    staleTime: 0
  });

  if (couponsQuery.isPending) {
    return <Text accessibilityLiveRegion="polite" selectable style={detailStyle}>Loading promo codes...</Text>;
  }
  if (couponsQuery.isError) {
    return <View style={{ gap: 8 }}>
      <Text selectable style={detailStyle}>Available promo codes could not be loaded. You can still enter a code above.</Text>
      <Button disabled={props.disabled} loading={couponsQuery.isFetching} onPress={() => void couponsQuery.refetch()} variant="outline">Retry promo codes</Button>
    </View>;
  }
  return <AvailableCouponList {...props} coupons={couponsQuery.data.items} />;
}

export function AvailableCouponList({ coupons, appliedCode, disabled, onApply, subtotal }: CouponProps & { coupons: AvailableCoupon[] }) {
  const [cardSizes, setCardSizes] = useState<Record<string, { y: number; height: number }>>({});
  if (!coupons.length) return null;
  const hasMoreThanTwo = coupons.length > 2;
  const first = cardSizes[coupons[0]!.code];
  const second = coupons[1] ? cardSizes[coupons[1].code] : undefined;
  const visibleHeight = first && second ? second.y + second.height - first.y : undefined;

  return (
    <View accessibilityLabel="Available promo codes" style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 12, paddingTop: 16 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 14 }}>Available promo codes</Text>
      <ScrollView
        accessibilityLabel="Promo code list"
        contentContainerStyle={{ gap: 8, paddingRight: hasMoreThanTwo ? 4 : 0 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        persistentScrollbar={hasMoreThanTwo}
        scrollEnabled={hasMoreThanTwo}
        showsVerticalScrollIndicator={hasMoreThanTwo}
        style={{ flexGrow: 0, ...(hasMoreThanTwo ? { maxHeight: visibleHeight ?? 340 } : {}) }}
      >
        {coupons.map((coupon, index) => {
          const { remaining, isApplied, canApply } = getAvailableCouponState(coupon, subtotal, appliedCode);
          return (
            <View
              key={coupon.code}
              onLayout={index < 2 ? (event) => {
                const { y, height } = event.nativeEvent.layout;
                setCardSizes(current => current[coupon.code]?.y === y && current[coupon.code]?.height === height
                  ? current : { ...current, [coupon.code]: { y, height } });
              } : undefined}
              style={{ backgroundColor: "#f7fcfb", borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 8, padding: 12 }}
            >
              <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text selectable style={{ color: colors.primaryDark, fontFamily: fonts.heading, fontSize: 14 }}>{coupon.type === "PERCENTAGE" ? `${coupon.value}% off` : `${formatRupees(coupon.value)} off`}</Text>
                  <Text selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{coupon.code}</Text>
                </View>
                <Button accessibilityLabel={isApplied ? `${coupon.code} applied` : `Apply ${coupon.code}`} disabled={disabled || !canApply} onPress={() => onApply(coupon.code)} style={{ paddingHorizontal: 14 }} variant="outline">{isApplied ? "Applied" : "Apply"}</Button>
              </View>
              {coupon.minOrderAmount !== null ? <Text selectable style={detailStyle}>Minimum order {formatRupees(coupon.minOrderAmount)}</Text> : null}
              {coupon.maxDiscount !== null ? <Text selectable style={detailStyle}>Save up to {formatRupees(coupon.maxDiscount)}</Text> : null}
              {coupon.expiresAt ? <Text selectable style={detailStyle}>Expires {formatDate(coupon.expiresAt)}</Text> : null}
              {remaining > 0 ? <Text selectable style={detailStyle}>Add {formatRupees(remaining)} more to use this code.</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const detailStyle = { color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 20 } as const;
