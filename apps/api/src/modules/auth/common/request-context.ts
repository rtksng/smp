import type { Request } from "express";

export type AuthRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

// request.ip honours TRUST_PROXY and the trusted frontend proxy header (see
// TrustedClientIpMiddleware). Raw X-Forwarded-For values are not used because
// any client can set them.
export function getAuthRequestContext(request: Request): AuthRequestContext {
  return {
    ipAddress: request.ip,
    userAgent:
      typeof request.headers["user-agent"] === "string"
        ? request.headers["user-agent"]
        : undefined
  };
}
