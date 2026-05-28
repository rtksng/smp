import { AccountProfile } from "../../../components/account/account-profile";
import { buildPrivateMetadata } from "../../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "Update protected customer profile and business purchase details.",
  path: "/account/profile",
  title: "Account Profile"
});

export default function AccountProfilePage() {
  return <AccountProfile />;
}
