import { AccountQuotes } from "../../../components/account/account-quotes";
import { buildPrivateMetadata } from "../../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "View protected customer quote history, itemized quotation responses, and accepted quote checkout handoff.",
  path: "/account/quotes",
  title: "Account Quotes"
});

export default function AccountQuotesPage() {
  return <AccountQuotes />;
}
