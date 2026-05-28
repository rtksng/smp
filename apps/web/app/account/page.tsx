import { AccountOverview } from "../../components/account/account-overview";
import { buildPrivateMetadata } from "../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "Manage protected customer profile, addresses, and orders.",
  path: "/account",
  title: "Account Overview"
});

export default function AccountPage() {
  return <AccountOverview />;
}
