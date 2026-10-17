// Upload limits apply per signed-in account rather than per IP, so customers
// sharing a carrier IP are not limited together. The global throttler runs
// before the JWT guard, so the account is read from the not-yet-verified access
// token. A forged token gains nothing: the guard rejects the request before the
// file is accepted.
export function uploaderTracker(request: Record<string, unknown>) {
  const headers = request.headers as Record<string, unknown> | undefined;
  const authorization = headers?.authorization;
  const payload =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).split(".")[1]
      : undefined;

  if (payload) {
    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        audience?: unknown;
        sub?: unknown;
      };

      if (typeof claims.sub === "string" && claims.sub.length > 0) {
        return `account:${String(claims.audience ?? "")}:${claims.sub}`;
      }
    } catch {
      // Not a JWT; fall back to the IP below.
    }
  }

  return String(request.ip ?? "unknown");
}

export const UPLOAD_THROTTLE_LIMITS = {
  // Catalog work uploads many images in a row.
  admin: { getTracker: uploaderTracker, limit: 120, ttl: 60_000 },
  customer: { getTracker: uploaderTracker, limit: 10, ttl: 10 * 60_000 },
  // Covers documents plus a proof photo per delivery.
  deliveryPartner: { getTracker: uploaderTracker, limit: 30, ttl: 10 * 60_000 }
} as const;
