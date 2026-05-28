import { CartPage } from "../../components/cart/cart-page";
import { buildPrivateMetadata } from "../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "Review your protected customer cart before checkout.",
  path: "/cart",
  title: "Cart"
});

export default function CustomerCartPage() {
  return <CartPage />;
}
