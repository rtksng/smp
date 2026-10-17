import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import type { PrismaService } from "../../src/database/prisma.service";
import {
  AuthTokenAudience,
  AuthTokenService
} from "../../src/modules/auth/common/auth-token.service";
import type { OtpService } from "../../src/modules/auth/common/otp.service";
import { RefreshInProgressException } from "../../src/modules/auth/common/refresh-rotation";
import { CustomerAuthController } from "../../src/modules/auth/customer/customer-auth.controller";
import { CustomerAuthService } from "../../src/modules/auth/customer/customer-auth.service";

const EXPIRES = new Date("2026-11-17T10:00:00.000Z");

function tokens() {
  return {
    accessToken: "access",
    accessTokenExpiresAt: EXPIRES,
    accessTokenExpiresInSeconds: 900,
    refreshToken: "refresh-new",
    refreshTokenExpiresAt: EXPIRES,
    refreshTokenExpiresInSeconds: 2_592_000,
    tokenType: "Bearer" as const
  };
}

function fakeRequest(headers: Record<string, string>) {
  return { headers, ip: "203.0.113.7" } as unknown as Request;
}

function fakeResponse() {
  const cookies: Array<{ name: string; options: Record<string, unknown>; value: string }> = [];
  const cleared: string[] = [];
  const response = {
    clearCookie: (name: string) => {
      cleared.push(name);
    },
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      cookies.push({ name, options, value });
    }
  } as unknown as Response;

  return { cleared, cookies, response };
}

function controller(received: { refresh?: unknown[]; logout?: unknown[] } = {}) {
  const service = {
    logout: async (refreshToken: string | undefined) => {
      received.logout?.push(refreshToken);
      return { loggedOut: true };
    },
    refresh: async (refreshToken: string | undefined) => {
      received.refresh?.push(refreshToken);
      return { tokens: tokens() };
    },
    verifyOtp: async () => ({ tokens: tokens(), user: { id: "user-1" } })
  };

  return new CustomerAuthController(service as unknown as CustomerAuthService);
}

const BROWSER = { cookie: "surgical_customer_refresh=refresh-old", origin: "https://shop.example.in" };

test("browsers get the refresh token only as an httpOnly cookie", async () => {
  const { cookies, response } = fakeResponse();

  const result = await controller().verifyOtp(
    { mobileNumber: "+919876543210", otp: "123456" },
    fakeRequest({ origin: "https://shop.example.in" }),
    response
  );

  assert.equal("refreshToken" in result.tokens, false);
  assert.equal(cookies[0]?.name, "surgical_customer_refresh");
  assert.equal(cookies[0]?.value, "refresh-new");
  assert.equal(cookies[0]?.options.httpOnly, true);
});

test("native apps keep the refresh token in the body and get no cookie", async () => {
  for (const headers of [{}, { origin: "https://shop.example.in", "x-client-platform": "native" }]) {
    const { cookies, response } = fakeResponse();

    const result = await controller().verifyOtp(
      { mobileNumber: "+919876543210", otp: "123456" },
      fakeRequest(headers),
      response
    );

    assert.equal((result.tokens as { refreshToken?: string }).refreshToken, "refresh-new");
    assert.equal(cookies.length, 0);
  }
});

test("browser refreshes read only the cookie, never a token sent in the body", async () => {
  const received = { refresh: [] as unknown[] };
  const { response } = fakeResponse();

  const result = await controller(received).refresh(
    { refreshToken: "token-from-script" },
    fakeRequest(BROWSER),
    response
  );

  assert.deepEqual(received.refresh, ["refresh-old"]);
  assert.equal("refreshToken" in result.tokens, false);
});

test("native refreshes read only the body, never a cookie", async () => {
  const received = { refresh: [] as unknown[] };
  const { cookies, response } = fakeResponse();

  await controller(received).refresh(
    { refreshToken: "refresh-from-app" },
    fakeRequest({ cookie: "surgical_customer_refresh=refresh-old" }),
    response
  );

  assert.deepEqual(received.refresh, ["refresh-from-app"]);
  assert.equal(cookies.length, 0);
});

test("browser logout revokes the cookie's session and clears the cookie", async () => {
  const received = { logout: [] as unknown[] };
  const { cleared, response } = fakeResponse();

  await controller(received).logout({}, fakeRequest(BROWSER), response);

  assert.deepEqual(received.logout, ["refresh-old"]);
  assert.deepEqual(cleared, ["surgical_customer_refresh"]);
});

// Service-level rotation with real signed tokens.

const tokenService = new AuthTokenService({
  accessSecret: "test-access-secret",
  accessTtlSeconds: 60,
  refreshSecret: "test-refresh-secret",
  refreshTtlSeconds: 3600
});

async function sessionWith(refreshToken: string, overrides: Record<string, unknown> = {}) {
  return {
    expiresAt: EXPIRES,
    id: "session-1",
    previousRefreshToken: null as string | null,
    refreshToken: tokenService.hashRefreshToken(refreshToken),
    refreshTokenRotatedAt: null as Date | null,
    revokedAt: null as Date | null,
    user: { deletedAt: null, isActive: true },
    userId: "user-1",
    ...overrides
  };
}

function servicePrisma(session: Awaited<ReturnType<typeof sessionWith>>) {
  const prisma = {
    userSession: {
      findFirst: async () => (session.revokedAt ? null : session),
      updateMany: async (args: { data: Record<string, unknown>; where: Record<string, unknown> }) => {
        if (
          ("refreshToken" in args.where && args.where.refreshToken !== session.refreshToken) ||
          session.revokedAt
        ) {
          return { count: 0 };
        }
        Object.assign(session, args.data);
        return { count: 1 };
      }
    }
  };

  return prisma as unknown as PrismaService;
}

async function issueRefreshToken() {
  const pair = await tokenService.issueTokenPair({
    audience: AuthTokenAudience.Customer,
    sessionId: "session-1",
    subject: "user-1"
  });
  return pair.refreshToken;
}

test("customer refresh rotates the session and a replayed old token ends it", async () => {
  const first = await issueRefreshToken();
  const session = await sessionWith(first);
  const service = new CustomerAuthService(
    tokenService,
    {} as unknown as OtpService,
    servicePrisma(session)
  );
  const context = { ipAddress: "203.0.113.7", userAgent: "test" };

  const rotated = await service.refresh(first, context);
  assert.equal(session.refreshToken, tokenService.hashRefreshToken(rotated.tokens.refreshToken));
  assert.equal(session.previousRefreshToken, tokenService.hashRefreshToken(first));

  // Within the grace window the old token is a concurrent refresh, not theft.
  await assert.rejects(() => service.refresh(first, context), RefreshInProgressException);
  assert.equal(session.revokedAt, null);

  // Two rotations later the first token is plainly stale: end the session.
  await service.refresh(rotated.tokens.refreshToken, context);
  await assert.rejects(() => service.refresh(first, context), UnauthorizedException);
  assert.ok(session.revokedAt instanceof Date);
});
