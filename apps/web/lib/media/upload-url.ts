const MANAGED_UPLOAD_HOST_SUFFIXES = [".up.railway.app"];
const STALE_UPLOAD_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "smp-production-b700.up.railway.app"
]);

export function resolveCustomerUploadUrl(value: string) {
  const apiOrigin = getConfiguredApiOrigin();

  if (!apiOrigin) {
    return value;
  }

  try {
    const parsedUrl = new URL(value);

    if (!isManagedUploadPath(parsedUrl.pathname)) {
      return value;
    }

    if (parsedUrl.origin === apiOrigin) {
      return value;
    }

    if (!isKnownManagedUploadHost(parsedUrl.hostname)) {
      return value;
    }

    return `${apiOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    if (value.startsWith("/uploads/")) {
      return `${apiOrigin}${value}`;
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
  return pathname === "/uploads" || pathname.startsWith("/uploads/");
}

function isKnownManagedUploadHost(hostname: string) {
  return (
    STALE_UPLOAD_HOSTS.has(hostname) ||
    MANAGED_UPLOAD_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}
