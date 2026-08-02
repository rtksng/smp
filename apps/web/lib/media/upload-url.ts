const MANAGED_UPLOAD_HOST_SUFFIXES = [".up.railway.app"];
const STALE_UPLOAD_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "smp-production-b700.up.railway.app"
]);

export function resolveCustomerUploadUrl(value: string) {
  const legacyUploadPath = getLegacyUploadPath(value);

  if (legacyUploadPath) {
    if (isStaticUploadFallbackEnabled()) {
      return legacyUploadPath;
    }

    const apiOrigin = getConfiguredApiOrigin();
    return apiOrigin ? `${apiOrigin}${legacyUploadPath}` : legacyUploadPath;
  }

  try {
    const parsedUrl = new URL(value);

    if (!isManagedUploadPath(parsedUrl.pathname)) {
      return value;
    }

    if (!isKnownManagedUploadHost(parsedUrl.hostname)) {
      return value;
    }

    if (isStaticUploadFallbackEnabled()) {
      const proxyPath = parsedUrl.pathname.startsWith("/catalog/")
        ? `/uploads${parsedUrl.pathname}`
        : parsedUrl.pathname;

      return `${proxyPath}${parsedUrl.search}${parsedUrl.hash}`;
    }

    const apiOrigin = getConfiguredApiOrigin();

    if (!apiOrigin || parsedUrl.origin === apiOrigin) {
      return value;
    }

    return `${apiOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    if (value.startsWith("/uploads/")) {
      return value;
    }

    if (value.startsWith("/catalog/")) {
      return `/uploads${value}`;
    }

    return value;
  }
}

export function resolveNullableCustomerUploadUrl(value: string | null) {
  return value ? resolveCustomerUploadUrl(value) : value;
}

function getConfiguredApiOrigin() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return null;
  }

  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

function isManagedUploadPath(pathname: string) {
  return (
    pathname === "/uploads" ||
    pathname.startsWith("/uploads/") ||
    pathname === "/catalog" ||
    pathname.startsWith("/catalog/")
  );
}

function isStaticUploadFallbackEnabled() {
  // Customer uploads are served through the local /uploads proxy by default.
  // This lets the same Railway DNS fallback used for API calls serve media.
  return process.env.NEXT_PUBLIC_STATIC_UPLOAD_FALLBACK !== "false";
}

function getLegacyUploadPath(value: string) {
  const rawValue = String(value ?? "").trim();
  let legacyValue = rawValue;

  try {
    legacyValue = decodeURIComponent(new URL(rawValue).pathname).replace(/^\/+/, "");
  } catch {
    // Raw values such as '<UNKNOWN>/catalog/...' are handled below.
  }

  const match = legacyValue.match(/^<?UNKNOWN>\/?(.+)$/i) ?? rawValue.match(/^<[^>]+>\/?(.+)$/i);

  if (!match?.[1]) {
    return null;
  }

  return `/uploads/${match[1].replace(/^(uploads\/?)?/i, "")}`;
}

function isKnownManagedUploadHost(hostname: string) {
  return (
    STALE_UPLOAD_HOSTS.has(hostname) ||
    MANAGED_UPLOAD_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}
