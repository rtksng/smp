import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AuthTokenAudience,
  AuthTokenService
} from "../../src/modules/auth/common/auth-token.service";

test("issued access tokens can only be verified for their own auth audience", async () => {
  const tokens = new AuthTokenService({
    accessSecret: "test-access-secret",
    accessTtlSeconds: 60,
    refreshSecret: "test-refresh-secret",
    refreshTtlSeconds: 3600
  });

  const pair = await tokens.issueTokenPair({
    audience: AuthTokenAudience.Customer,
    sessionId: "session-1",
    subject: "user-1"
  });

  const customerPayload = await tokens.verifyAccessToken(
    pair.accessToken,
    AuthTokenAudience.Customer
  );

  assert.equal(customerPayload.sub, "user-1");
  assert.equal(customerPayload.sessionId, "session-1");
  assert.equal(customerPayload.audience, AuthTokenAudience.Customer);
  await assert.rejects(
    () => tokens.verifyAccessToken(pair.accessToken, AuthTokenAudience.Admin),
    /invalid token audience/i
  );
});

test("refresh token digests are stable and do not expose raw tokens", async () => {
  const tokens = new AuthTokenService({
    accessSecret: "test-access-secret",
    accessTtlSeconds: 60,
    refreshSecret: "test-refresh-secret",
    refreshTtlSeconds: 3600
  });

  const pair = await tokens.issueTokenPair({
    audience: AuthTokenAudience.Admin,
    permissions: ["orders:read"],
    role: "operations_admin",
    sessionId: "admin-session-1",
    subject: "admin-1"
  });

  assert.notEqual(tokens.hashRefreshToken(pair.refreshToken), pair.refreshToken);
  assert.equal(
    tokens.hashRefreshToken(pair.refreshToken),
    tokens.hashRefreshToken(pair.refreshToken)
  );
  assert.equal(
    (await tokens.verifyRefreshToken(pair.refreshToken, AuthTokenAudience.Admin))
      .permissions?.[0],
    "orders:read"
  );
});
