"use client";

import { useSearchParams } from "next/navigation";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { ErrorState } from "../ui/error-state";

export function PaymentFailedPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const reason = searchParams.get("reason");
  const retryHref = orderId
    ? `/account/orders/${encodeURIComponent(orderId)}`
    : "/checkout";

  return (
    <>
      <Header />
      <main className="bg-[#f3faf9]">
        <Container className="py-8">
          <ErrorState
            action={
              <>
                <Button href={retryHref}>
                  {orderId ? "Retry payment" : "Retry checkout"}
                </Button>
                <Button href={orderId ? "/account/orders" : "/cart"} variant="outline">
                  {orderId ? "View orders" : "Back to cart"}
                </Button>
                <Button href="/products" variant="ghost">
                  Continue shopping
                </Button>
              </>
            }
            className="bg-white"
            message={
              reason ??
              (orderId
                ? "Payment failed. Your order is saved as pending, so you can retry payment or cancel it from order details."
                : "Payment failed. The payment was cancelled or could not be verified. You can retry checkout or contact support if money was deducted.")
            }
            title="We could not confirm your online payment"
          />
        </Container>
      </main>
      <Footer />
    </>
  );
}
