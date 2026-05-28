import { Suspense } from "react";
import { PaymentFailedPage } from "../../components/checkout/payment-failed-page";
import { PageLoader } from "../../components/ui/loading-spinner";
import { buildPrivateMetadata } from "../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "Review protected payment failure details and retry checkout.",
  path: "/payment-failed",
  title: "Payment Failed"
});

export default function PaymentFailedRoute() {
  return (
    <Suspense fallback={<PageLoader label="Loading payment status" />}>
      <PaymentFailedPage />
    </Suspense>
  );
}
