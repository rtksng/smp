import { AccountAddresses } from "../../../components/account/account-addresses";
import { buildPrivateMetadata } from "../../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "Manage protected customer delivery addresses for checkout.",
  path: "/account/addresses",
  title: "Account Addresses"
});

export default function AccountAddressesPage() {
  return <AccountAddresses />;
}
