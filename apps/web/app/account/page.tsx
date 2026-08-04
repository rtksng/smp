import { CustomerAccountLanding } from "../../components/account/customer-account-shell";
import { AccountProfileContent } from "../../components/account/account-profile";
import { buildPrivateMetadata } from "../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description: "Manage protected customer profile, orders, and saved details.",
  path: "/account",
  title: "Account"
});

export default function AccountPage() {
  return (
    <CustomerAccountLanding>
      <AccountProfileContent />
    </CustomerAccountLanding>
  );
}
