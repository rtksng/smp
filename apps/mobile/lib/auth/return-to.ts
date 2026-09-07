import type { Href } from "expo-router";

const allowedExactPaths = new Set([
  "/",
  "/account",
  "/account/profile",
  "/account/quotes",
  "/account/wishlist",
  "/addresses",
  "/addresses/form",
  "/cart",
  "/brands",
  "/categories",
  "/checkout",
  "/orders",
  "/search"
]);

const allowedDynamicPaths = [
  /^\/orders\/[^/?#]+$/,
  /^\/order-success\/[^/?#]+$/,
  /^\/products\/[^/?#]+$/,
  /^\/brands\/[^/?#]+$/
];

export function resolveAuthReturnTo(value: string | string[] | undefined): Href {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/account";
  }

  const pathname = candidate.split(/[?#]/, 1)[0] ?? "";

  if (
    allowedExactPaths.has(pathname) ||
    allowedDynamicPaths.some((pattern) => pattern.test(pathname))
  ) {
    return candidate as Href;
  }

  return "/account";
}
