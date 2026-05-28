import { HomePage } from "../components/home/home-page";
import {
  buildMetadata,
  defaultDescription,
  siteName
} from "../lib/seo/metadata";

export const metadata = buildMetadata({
  description: defaultDescription,
  image:
    "https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1200&q=80",
  imageAlt: "Surgical and medical equipment prepared for clinical procurement",
  path: "/",
  title: siteName
});

export const dynamic = "force-dynamic";

export default function CustomerHomePage() {
  return <HomePage />;
}
