"use client";

import { useSearchParams } from "next/navigation";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { ErrorState } from "../ui/error-state";

export function PaymentFailedPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  return (
    <>
      <Header />
      <main className="bg-[#f4f9ff]">
        <Container className="py-8">
          <ErrorState
            action={
              <>
                <Button href="/checkout">Retry checkout</Button>
                <Button href="/cart" variant="outline">
                  Back to cart
                </Button>
                <Button href="/products" variant="ghost">
                  Continue shopping
                </Button>
              </>
            }
            className="bg-white"
            message={
              reason ??
              "Payment failed. The payment was cancelled or could not be verified. You can retry checkout or contact support if money was deducted."
            }
            title="We could not confirm your online payment"
          />
        </Container>
      </main>
      <Footer />
    </>
  );
}
