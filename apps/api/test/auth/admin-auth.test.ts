import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpException, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import type { PrismaService } from "../../src/database/prisma.service";
import { AdminAuthController } from "../../src/modules/auth/admin/admin-auth.controller";
import {
  AdminAuthService,
  MAX_FAILED_ADMIN_LOGINS
} from "../../src/modules/auth/admin/admin-auth.service";
import { AuthTokenService } from "../../src/modules/auth/common/auth-token.service";
import type { PasswordService } from "../../src/modules/auth/common/password.service";
import type { RedisCacheService } from "../../src/modules/auth/common/redis-cache.service";

const tokenService = new AuthTokenService({
  accessSecret: "test-access-secret",
  accessTtlSeconds: 60,
  refreshSecret: "test-refresh-secret",
  refreshTtlSeconds: 3600
});
const CONTEXT = { ipAddress: "203.0.113.7", userAgent: "test" };

const admin = {
  deletedAt: null,
  email: "ops@example.in",
  firstName: "Ops",
  id: "admin-1",
  lastName: null,
  passwordHash: "hash",
  role: {
    code: "ORDER_MANAGER",
    name: "Order manager",
    permissions: [{ permission: { code: "orders.read" } }]
  },
  status: "ACTIVE"
};

class FakeAttempts {
  readonly values = new Map<string, string>();
  failing = false;

  async get(key: string) {
    if (this.failing) throw new Error("Redis unavailable");
    return this.values.get(key) ?? null;
  }

  async increment(key: string) {
    if (this.failing) throw new Error("Redis unavailable");
    const next = Number(this.values.get(key) ?? 0) + 1;
    this.values.set(key, String(next));
    return next;
  }

  async delete(key: string) {
    if (this.failing) throw new Error("Redis unavailable");
    this.values.delete(key);
  }
}

function service(attempts = new FakeAttempts(), validPassword = "Correct-Horse-42") {
  const prisma = {
    $transaction: async () => [],
    adminSession: {
      create: () => ({}),
      findFirst: async () => null
    },
    adminUser: {
      findFirst: async () => admin,
      update: () => ({})
    }
  };
  const passwords = {
    verify: async (password: string) => password === validPassword
  };

  return {
    attempts,
    service: new AdminAuthService(
      tokenService,
      passwords as unknown as PasswordService,
      prisma as unknown as PrismaService,
      attempts as unknown as RedisCacheService
    )
  };
}

const login = (password: string) => ({ email: "ops@example.in", password });

test("admin login locks an account after repeated wrong passwords", async () => {
  const { attempts, service: auth } = service();

  for (let attempt = 0; attempt < MAX_FAILED_ADMIN_LOGINS; attempt += 1) {
    await assert.rejects(() => auth.login(login("wrong-password-1"), CONTEXT), UnauthorizedException);
  }

  // Even the right password is refused while the account is locked.
  await assert.rejects(
    () => auth.login(login("Correct-Horse-42"), CONTEXT),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429
  );
  assert.equal(attempts.values.get("auth:admin-login:failures:ops@example.in"), "5");
});

test("a successful admin login clears earlier failures", async () => {
  const { attempts, service: auth } = service();

  await assert.rejects(() => auth.login(login("wrong-password-1"), CONTEXT), UnauthorizedException);
  const result = await auth.login(login("Correct-Horse-42"), CONTEXT);

  assert.equal(result.admin.email, "ops@example.in");
  assert.deepEqual(result.admin.permissions, ["orders.read"]);
  assert.equal(attempts.values.size, 0);
});

test("admin login still works when the lockout store is unavailable", async () => {
  const attempts = new FakeAttempts();
  attempts.failing = true;
  const { service: auth } = service(attempts);

  const result = await auth.login(login("Correct-Horse-42"), CONTEXT);

  assert.equal(result.admin.id, "admin-1");
});

function fakeResponse() {
  const cookies: Array<{ name: string; options: Record<string, unknown>; value: string }> = [];
  const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
  const response = {
    clearCookie: (name: string, options: Record<string, unknown>) => cleared.push({ name, options }),
    cookie: (name: string, value: string, options: Record<string, unknown>) =>
      cookies.push({ name, options, value })
  } as unknown as Response;

  return { cleared, cookies, response };
}

test("admin tokens reach the browser only as a strict httpOnly cookie on the auth path", async () => {
  const { service: auth } = service();
  const controller = new AdminAuthController(auth);
  const { cookies, response } = fakeResponse();

  const result = await controller.login(
    login("Correct-Horse-42"),
    { headers: {}, ip: "203.0.113.7" } as unknown as Request,
    response
  );

  assert.equal("refreshToken" in result.tokens, false);
  assert.equal(cookies[0]?.name, "surgical_admin_refresh");
  assert.equal(cookies[0]?.options.httpOnly, true);
  assert.equal(cookies[0]?.options.sameSite, "strict");
  assert.equal(cookies[0]?.options.path, "/api/v1/auth/admin");
});

test("admin refresh and logout use the cookie, and logout clears it", async () => {
  const received: Array<[string, string | undefined]> = [];
  const auth = {
    logout: async (token: string | undefined) => {
      received.push(["logout", token]);
      return { loggedOut: true };
    },
    refresh: async (token: string | undefined) => {
      received.push(["refresh", token]);
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
  };
  const controller = new AdminAuthController(auth as unknown as AdminAuthService);
  const request = {
    headers: { cookie: "other=1; surgical_admin_refresh=cookie-token" },
    ip: "203.0.113.7"
  } as unknown as Request;
  const { cleared, response } = fakeResponse();

  await assert.rejects(() => controller.refresh(request, response), UnauthorizedException);
  await controller.logout(request, response);

  assert.deepEqual(received, [
    ["refresh", "cookie-token"],
    ["logout", "cookie-token"]
  ]);
  assert.equal(cleared[0]?.name, "surgical_admin_refresh");
});
