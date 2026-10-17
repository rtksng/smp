import type { Request, Response } from "express";

export const CUSTOMER_REFRESH_COOKIE = "surgical_customer_refresh";
export const ADMIN_REFRESH_COOKIE = "surgical_admin_refresh";

// Native apps may send this header. Clients that send it, or that send no
// Origin header, keep the refresh token in the request and response body.
export const CLIENT_PLATFORM_HEADER = "x-client-platform";

type RefreshCookieOptions = {
  path: string;
  sameSite: "lax" | "strict";
};

// Browsers always send an Origin header with these POST requests, and page
// scripts cannot remove it, so a browser can never receive a refresh token in
// a response body that an injected script could read.
export function isBrowserRequest(request: Request) {
  return (
    request.headers[CLIENT_PLATFORM_HEADER] !== "native" &&
    typeof request.headers.origin === "string"
  );
}

export function setRefreshCookie(
  response: Response,
  name: string,
  refreshToken: string,
  expires: Date,
  options: RefreshCookieOptions
) {
  response.cookie(name, refreshToken, {
    expires,
    httpOnly: true,
    path: options.path,
    sameSite: options.sameSite,
    secure: process.env.NODE_ENV === "production"
  });
}

export function clearRefreshCookie(
  response: Response,
  name: string,
  options: RefreshCookieOptions
) {
  response.clearCookie(name, {
    httpOnly: true,
    path: options.path,
    sameSite: options.sameSite,
    secure: process.env.NODE_ENV === "production"
  });
}

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .map((entry) => entry.split("="))
    .find(([key]) => key === name)?.[1];
}

export function withoutRefreshToken<T extends { refreshToken: string }>(tokens: T) {
  const { refreshToken: _refreshToken, ...rest } = tokens;
  void _refreshToken;
  return rest;
}
