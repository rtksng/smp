const DEFAULT_RAILWAY_STORAGE_BASE_URL =
  "https://pxseurailproxy-production-1f3a.up.railway.app";
const MANAGED_UPLOAD_HOST_SUFFIXES = [".up.railway.app"];
const STALE_UPLOAD_HOSTS = new Set([
  "localhost",
  "127.0.0.1"
]);

export function resolveCustomerUploadUrl(value: string) {
  const storageBaseUrl = getConfiguredStorageBaseUrl();
  const legacyUploadPath = getLegacyUploadPath(value);

  if (legacyUploadPath) {
    if (shouldUseLocalUploadProxy()) {
      return `/uploads/${legacyUploadPath}`;
    }

    return resolveStorageUrl(storageBaseUrl, legacyUploadPath) ?? value;
  }

  try {
    const parsedUrl = new URL(value);

    if (!isManagedUploadPath(parsedUrl.pathname)) {
      return value;
    }

    if (!isKnownManagedUploadHost(parsedUrl.hostname)) {
      return value;
    }

    if (shouldUseLocalUploadProxy()) {
      const proxyPath = parsedUrl.pathname.startsWith("/catalog/")
        ? `/uploads${parsedUrl.pathname}`
        : parsedUrl.pathname;

      return `${proxyPath}${parsedUrl.search}${parsedUrl.hash}`;
    }

    const storageUrl = resolveStorageUrl(storageBaseUrl, parsedUrl.pathname);

    return storageUrl
      ? `${storageUrl}${parsedUrl.search}${parsedUrl.hash}`
      : value;
  } catch {
    if (value.startsWith("/uploads/") || value.startsWith("/catalog/")) {
      if (shouldUseLocalUploadProxy()) {
        return value.startsWith("/catalog/") ? `/uploads${value}` : value;
      }

      return resolveStorageUrl(storageBaseUrl, value) ?? value;
    }

    return value;
  }
}

function shouldUseLocalUploadProxy() {
  return process.env.NODE_ENV !== "production";
}

export function resolveNullableCustomerUploadUrl(value: string | null) {
  return value ? resolveCustomerUploadUrl(value) : value;
}

function getConfiguredStorageBaseUrl() {
  const storageBaseUrl =
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ??
    process.env.STORAGE_PUBLIC_BASE_URL;

  if (storageBaseUrl) {
    return storageBaseUrl;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return null;
  }

  try {
    const apiOrigin = new URL(apiUrl).origin;

    return new URL(apiOrigin).hostname.endsWith(".up.railway.app")
      ? DEFAULT_RAILWAY_STORAGE_BASE_URL
      : `${apiOrigin}/uploads`;
  } catch {
    return null;
  }
}

function resolveStorageUrl(storageBaseUrl: string | null, uploadPath: string) {
  if (!storageBaseUrl) {
    return null;
  }

  const relativePath = uploadPath
    .replace(/^\/+/, "")
    .replace(/^uploads\/?/i, "");

  try {
    return new URL(relativePath, `${storageBaseUrl.replace(/\/+$/, "")}/`).toString();
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
