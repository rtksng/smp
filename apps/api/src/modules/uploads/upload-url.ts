const DEFAULT_STORAGE_PUBLIC_BASE_URL = "http://localhost:4000/uploads";
const DEFAULT_STORAGE_PUBLIC_PATH = "uploads";

export function resolveStoredUploadUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const key = extractUploadKey(
    value,
    process.env.STORAGE_PUBLIC_PATH ?? DEFAULT_STORAGE_PUBLIC_PATH
  );

  if (!key) {
    return value;
  }

  return `${storagePublicBaseUrl()}/${key}`;
}

export function resolveStoragePublicBaseUrl(value?: string) {
  const configuredValue = (
    value ?? process.env.STORAGE_PUBLIC_BASE_URL ?? DEFAULT_STORAGE_PUBLIC_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "");

  // Production refuses to start without a valid STORAGE_PUBLIC_BASE_URL (see
  // api.config.ts), so this default only applies in local development.
  return isValidPublicBaseUrl(configuredValue)
    ? configuredValue
    : DEFAULT_STORAGE_PUBLIC_BASE_URL;
}

function storagePublicBaseUrl() {
  return resolveStoragePublicBaseUrl();
}

function extractUploadKey(value: string, publicPath: string) {
  const normalizedPublicPath =
    publicPath.replace(/^\/+|\/+$/g, "") || DEFAULT_STORAGE_PUBLIC_PATH;

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const publicPathIndex = segments.indexOf(normalizedPublicPath);

    if (publicPathIndex >= 0 && publicPathIndex < segments.length - 1) {
      return segments.slice(publicPathIndex + 1).join("/");
    }
  } catch {
    const normalizedValue = value
      .replace(/\\/g, "/")
      .replace(/^<UNKNOWN>\/?/i, "")
      .replace(/^\/+/, "");

    if (normalizedValue.startsWith(`${normalizedPublicPath}/`)) {
      return normalizedValue.slice(normalizedPublicPath.length + 1);
    }

    if (normalizedValue.startsWith("catalog/")) {
      return normalizedValue;
    }
  }

  return null;
}

export function isValidPublicBaseUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
