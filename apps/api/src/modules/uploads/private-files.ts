import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { API_VERSION_PREFIX } from "@surgical/config";

// Customer and delivery partner files (documents, delivery proofs, incident
// photos) live under this prefix, with the owner's id in the key. They are
// never given a public URL; viewers get a short-lived link signed by the API,
// which checks the signature and streams the file.
export const PRIVATE_KEY_PREFIX = "private/";

// Links stay valid 15-30 minutes. Expiry is rounded to the window so repeated
// page loads produce the same URL and the browser can cache the file.
const LINK_WINDOW_SECONDS = 15 * 60;

export type PrivateFileOwner =
  | { id: string; kind: "customer" }
  | { id: string; kind: "delivery_partner" };

export function privateOwnerPrefix(owner: PrivateFileOwner) {
  const folder = owner.kind === "customer" ? "customers" : "delivery-partners";

  return `${PRIVATE_KEY_PREFIX}${folder}/${owner.id}/`;
}

// True when the key was issued by an upload made by this owner.
export function isOwnedPrivateKey(key: string | null | undefined, owner: PrivateFileOwner) {
  return (
    typeof key === "string" &&
    key.startsWith(privateOwnerPrefix(owner)) &&
    !key.includes("..")
  );
}

export function signPrivateFileUrl(key: string, now?: number): string;
export function signPrivateFileUrl(key: string | null | undefined, now?: number): string | null;
export function signPrivateFileUrl(
  key: string | null | undefined,
  now = Date.now()
): string | null {
  if (!key) {
    return null;
  }

  const windowStart = Math.floor(now / 1000 / LINK_WINDOW_SECONDS) * LINK_WINDOW_SECONDS;
  const expires = windowStart + 2 * LINK_WINDOW_SECONDS;
  const path = key.split("/").map(encodeURIComponent).join("/");

  return `${apiPublicUrl()}${API_VERSION_PREFIX}/files/${path}?expires=${expires}&signature=${sign(key, expires)}`;
}

export function verifyPrivateFileSignature(
  key: string,
  expires: unknown,
  signature: unknown,
  now = Date.now()
) {
  const expiresAt = Number(expires);

  if (
    typeof signature !== "string" ||
    !Number.isInteger(expiresAt) ||
    expiresAt * 1000 < now
  ) {
    return false;
  }

  const expected = Buffer.from(sign(key, expiresAt));
  const presented = Buffer.from(signature);

  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

function sign(key: string, expires: number) {
  return createHmac("sha256", signingKey()).update(`${key}\n${expires}`).digest("base64url");
}

// Without the API's secret (tests, scripts) links are signed with a key that
// exists only in this process, so they can never be forged or reused elsewhere.
const PROCESS_ONLY_KEY = randomBytes(32);

// Derived from the access token secret so no extra secret is needed; the
// label keeps file signatures distinct from anything else signed with it.
function signingKey() {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_ACCESS_SECRET is required to sign private file links.");
    }

    return PROCESS_ONLY_KEY;
  }

  return createHmac("sha256", secret).update("private-file-links").digest();
}

// API_PUBLIC_URL, else the domain Railway assigns the service, else local.
function apiPublicUrl() {
  const configured =
    process.env.API_PUBLIC_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined);

  return (configured ?? `http://localhost:${process.env.API_PORT ?? 4000}`).replace(/\/+$/, "");
}
