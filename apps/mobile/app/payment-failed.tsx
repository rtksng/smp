import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { ErrorState } from "@/components/ui/state-view";

export default function PaymentFailedScreen() {
  const { orderId, reason } = useLocalSearchParams<{ orderId?: string; reason?: string }>();
  const retryHref = orderId ? ({ pathname: "/orders/[id]", params: { id: orderId } } as const) : "/checkout" as const;
  return (
    <Screen contentContainerStyle={{ paddingTop: 32 }}>
      <ErrorState
        action={
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button href={retryHref}>{orderId ? "Retry payment" : "Retry checkout"}</Button>
            <Button href={orderId ? "/orders" : "/cart"} variant="outline">{orderId ? "View orders" : "Back to cart"}</Button>
            <Button href="/search" variant="soft">Continue shopping</Button>
          </View>
        }
        message={reason ?? (orderId ? "Payment failed. Your order is saved as pending, so you can retry payment or cancel it from order details." : "Payment failed. The payment was cancelled or could not be verified. You can retry checkout or contact support if money was deducted.")}
        title="We could not confirm your online payment"
      />
    </Screen>
  );
}
