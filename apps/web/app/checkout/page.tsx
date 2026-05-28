import { CheckoutPage } from "../../components/checkout/checkout-page";
import { buildPrivateMetadata } from "../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "Complete protected customer checkout for surgical and medical equipment orders.",
  path: "/checkout",
  title: "Checkout"
});

export default function CustomerCheckoutPage() {
  return <CheckoutPage />;
}
