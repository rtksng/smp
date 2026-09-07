const MANAGED_UPLOAD_HOST_SUFFIXES = [".up.railway.app"];
const STALE_UPLOAD_HOSTS = new Set([
  "localhost",
  "127.0.0.1"
]);

export function resolveCustomerUploadUrl(value: string) {
  const legacyUploadPath = getLegacyUploadPath(value);

  if (legacyUploadPath) {
    return `/uploads/${legacyUploadPath}`;
  }

  try {
    const parsedUrl = new URL(value);

    if (!isManagedUploadPath(parsedUrl.pathname)) {
      return value;
    }

    if (!isKnownManagedUploadHost(parsedUrl.hostname)) {
      return value;
    }

    // Keep Railway's signed storage redirects on the server in every environment.
    const proxyPath = parsedUrl.pathname.startsWith("/catalog/")
      ? `/uploads${parsedUrl.pathname}`
      : parsedUrl.pathname;

    return `${proxyPath}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    if (value.startsWith("/uploads/") || value.startsWith("/catalog/")) {
      return value.startsWith("/catalog/") ? `/uploads${value}` : value;
    }

    return value;
  }
}

export function resolveNullableCustomerUploadUrl(value: string | null) {
  return value ? resolveCustomerUploadUrl(value) : value;
}

function isManagedUploadPath(pathname: string) {
  return (
    pathname === "/uploads" ||
    pathname.startsWith("/uploads/") ||
    pathname === "/catalog" ||
    pathname.startsWith("/catalog/")
  );
}

function getLegacyUploadPath(value: string) {
  const rawValue = String(value ?? "").trim();
  let legacyValue = rawValue;

  try {
    legacyValue = decodeURIComponent(new URL(rawValue).pathname).replace(/^\/+/, "");
  } catch {
    // Raw values such as '<UNKNOWN>/catalog/...' are handled below.
  }

  const match =
    legacyValue.match(/^<?UNKNOWN>\/?(.+)$/i) ??
    rawValue.match(/^<[^>]+>\/?(.+)$/i);

  if (!match?.[1]) {
    return null;
  }

  return match[1].replace(/^(uploads\/?)/i, "");
}

function isKnownManagedUploadHost(hostname: string) {
  return (
    STALE_UPLOAD_HOSTS.has(hostname) ||
    MANAGED_UPLOAD_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}
