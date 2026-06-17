import { buildPrivateMetadata } from "../../../lib/seo/metadata";
import { AccountWishlist } from "../../../components/account/account-wishlist";

export const metadata = buildPrivateMetadata({
  description: "Review saved customer products.",
  path: "/account/wishlist",
  title: "Wishlist"
});

export default function WishlistPage() {
  return <AccountWishlist />;
}
