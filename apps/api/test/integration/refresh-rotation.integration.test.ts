import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../src/database/prisma.service";
import {
  AuthTokenAudience,
  AuthTokenService
} from "../../src/modules/auth/common/auth-token.service";
import type { OtpService } from "../../src/modules/auth/common/otp.service";
import { RefreshInProgressException } from "../../src/modules/auth/common/refresh-rotation";
import { CustomerAuthService } from "../../src/modules/auth/customer/customer-auth.service";

// Runs the conditional rotation against a real, migrated PostgreSQL database.
const databaseUrl = process.env.DATABASE_TEST_URL;
const skip = databaseUrl ? false : "Set DATABASE_TEST_URL to a migrated test database.";
const CONTEXT = { ipAddress: "203.0.113.7", userAgent: "integration" };

let prisma: PrismaService;
const userIds: string[] = [];
const tokens = new AuthTokenService({
  accessSecret: "integration-access-secret",
  accessTtlSeconds: 60,
  refreshSecret: "integration-refresh-secret",
  refreshTtlSeconds: 3600
});

async function signedInCustomer() {
  const user = await prisma.user.create({
    data: {
      firstName: "Rotation",
      mobileNumber: `+91${Math.floor(6_000_000_000 + Math.random() * 3_999_999_999)}`
    }
  });
  userIds.push(user.id);
  const sessionId = randomUUID();
  const pair = await tokens.issueTokenPair({
    audience: AuthTokenAudience.Customer,
    sessionId,
    subject: user.id
  });
  await prisma.userSession.create({
    data: {
      expiresAt: pair.refreshTokenExpiresAt,
      id: sessionId,
      refreshToken: tokens.hashRefreshToken(pair.refreshToken),
      userId: user.id
    }
  });

  return { refreshToken: pair.refreshToken, sessionId };
}

before(async () => {
  if (!databaseUrl) return;
  prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
  await prisma.$connect();
});

after(async () => {
  if (!databaseUrl) return;
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("concurrent refreshes with one token rotate once without ending the session", { skip }, async () => {
  const service = new CustomerAuthService(tokens, {} as unknown as OtpService, prisma);
  const { refreshToken, sessionId } = await signedInCustomer();

  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () => service.refresh(refreshToken, CONTEXT))
  );
  const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sessionId } });

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(
    results.every(
      (result) =>
        result.status === "fulfilled" || result.reason instanceof RefreshInProgressException
    )
  );
  assert.equal(session.revokedAt, null);
  assert.equal(session.previousRefreshToken, tokens.hashRefreshToken(refreshToken));
});

test("a refresh token from two rotations ago ends the session", { skip }, async () => {
  const service = new CustomerAuthService(tokens, {} as unknown as OtpService, prisma);
  const { refreshToken: first, sessionId } = await signedInCustomer();

  const second = await service.refresh(first, CONTEXT);
  await service.refresh(second.tokens.refreshToken, CONTEXT);
  await assert.rejects(() => service.refresh(first, CONTEXT));

  const session = await prisma.userSession.findUniqueOrThrow({ where: { id: sessionId } });
  assert.ok(session.revokedAt);
});
