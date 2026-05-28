import { AccountOrders } from "../../../components/account/account-orders";
import { buildPrivateMetadata } from "../../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "View protected customer order history for surgical and medical equipment purchases.",
  path: "/account/orders",
  title: "Account Orders"
});

export default function AccountOrdersPage() {
  return <AccountOrders />;
}
