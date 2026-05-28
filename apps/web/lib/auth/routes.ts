const privateCustomerPaths = new Set([
  "/account",
  "/account/addresses",
  "/account/orders",
  "/account/profile",
  "/checkout"
]);

export function isPrivateCustomerPath(pathname: string) {
  const normalizedPath = normalizePath(pathname);

  return (
    privateCustomerPaths.has(normalizedPath) ||
    /^\/account\/orders\/[^/]+$/.test(normalizedPath)
  );
}

export function customerLoginHref(nextPath: string) {
  return `/login?next=${encodeURIComponent(toSafeNextPath(nextPath))}`;
}

export function toSafeNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}

function normalizePath(pathname: string) {
  const pathOnly = pathname.split(/[?#]/)[0] ?? "/";
  const withoutTrailingSlash =
    pathOnly.length > 1 ? pathOnly.replace(/\/+$/, "") : pathOnly;

  return withoutTrailingSlash || "/";
}
