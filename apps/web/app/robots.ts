import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "../lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    host: getAbsoluteUrl("/"),
    rules: {
      allow: ["/", "/products", "/products/", "/categories/", "/brands/"],
      disallow: [
        "/account",
        "/account/",
        "/cart",
        "/checkout",
        "/login",
        "/order-success",
        "/order-success/",
        "/payment-failed"
      ],
      userAgent: "*"
    },
    sitemap: getAbsoluteUrl("/sitemap.xml")
  };
}
