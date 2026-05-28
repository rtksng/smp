import type { Request } from "express";

export type AuthRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

function firstForwardedIp(value: Request["headers"]["x-forwarded-for"]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value?.split(",")[0]?.trim();
}

export function getAuthRequestContext(request: Request): AuthRequestContext {
  return {
    ipAddress: firstForwardedIp(request.headers["x-forwarded-for"]) ?? request.ip,
    userAgent:
      typeof request.headers["user-agent"] === "string"
        ? request.headers["user-agent"]
        : undefined
  };
}
