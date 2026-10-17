import assert from "node:assert/strict";
import { test } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import {
  assertCurrentRefreshToken,
  REFRESH_REUSE_GRACE_MS,
  RefreshInProgressException,
  revokeRefreshSession,
  rotateRefreshToken,
  type RotatableSession,
  type SessionStore
} from "../../src/modules/auth/common/refresh-rotation";

const NOW = new Date("2026-10-18T10:00:00.000Z");
const CONTEXT = { ipAddress: "203.0.113.7", userAgent: "test-agent" };

type StoredSession = RotatableSession & {
  expiresAt: Date;
  ipAddress?: string;
  revokedAt: Date | null;
  userAgent?: string;
};

// Applies the same conditions the database would for the fields these
// helpers filter on.
function sessionStore(session: StoredSession) {
  const calls: Array<{ data: Record<string, unknown>; where: Record<string, unknown> }> = [];
  const matches = (where: Record<string, unknown>) => {
    if (where.id !== session.id) return false;
    if ("revokedAt" in where && where.revokedAt === null && session.revokedAt !== null) return false;
    if ("refreshToken" in where && where.refreshToken !== session.refreshToken) return false;
    if (Array.isArray(where.OR)) {
      return (where.OR as Array<Record<string, string>>).some(
        (branch) =>
          (branch.refreshToken !== undefined && branch.refreshToken === session.refreshToken) ||
          (branch.previousRefreshToken !== undefined &&
            branch.previousRefreshToken === session.previousRefreshToken)
      );
    }
    return true;
  };
  const store: SessionStore = {
    updateMany: async (args) => {
      calls.push(args);
      if (!matches(args.where)) return { count: 0 };
      Object.assign(session, args.data);
      return { count: 1 };
    }
  };

  return { calls, session, store };
}

function storedSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    id: "session-1",
    previousRefreshToken: "hash-1",
    refreshToken: "hash-2",
    refreshTokenRotatedAt: new Date(NOW.getTime() - 5_000),
    revokedAt: null,
    ...overrides
  };
}

test("the current refresh token passes without touching the session", async () => {
  const { calls, session, store } = sessionStore(storedSession());

  await assertCurrentRefreshToken(store, session, "hash-2", NOW);

  assert.equal(calls.length, 0);
});

test("the token replaced moments ago asks the client to retry without ending the session", async () => {
  const { session, store } = sessionStore(storedSession());

  await assert.rejects(
    () => assertCurrentRefreshToken(store, session, "hash-1", NOW),
    RefreshInProgressException
  );
  assert.equal(session.revokedAt, null);
});

test("a replaced token reused after the grace window ends the session", async () => {
  const { session, store } = sessionStore(
    storedSession({ refreshTokenRotatedAt: new Date(NOW.getTime() - REFRESH_REUSE_GRACE_MS - 1) })
  );

  await assert.rejects(
    () => assertCurrentRefreshToken(store, session, "hash-1", NOW),
    UnauthorizedException
  );
  assert.deepEqual(session.revokedAt, NOW);
});

test("an older token than the last one replaced ends the session at once", async () => {
  const { session, store } = sessionStore(storedSession());

  await assert.rejects(
    () => assertCurrentRefreshToken(store, session, "hash-0", NOW),
    UnauthorizedException
  );
  assert.deepEqual(session.revokedAt, NOW);
});

test("rotation records the replaced token and only one of two concurrent rotations wins", async () => {
  const { session, store } = sessionStore(storedSession());
  const rotation = (nextHash: string) =>
    rotateRefreshToken(
      store,
      {
        context: CONTEXT,
        nextExpiresAt: new Date(NOW.getTime() + 172_800_000),
        nextHash,
        presentedHash: "hash-2",
        sessionId: "session-1"
      },
      NOW
    );

  const results = await Promise.allSettled([rotation("hash-3a"), rotation("hash-3b")]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.reason instanceof RefreshInProgressException);
  assert.equal(session.refreshToken, "hash-3a");
  assert.equal(session.previousRefreshToken, "hash-2");
  assert.deepEqual(session.refreshTokenRotatedAt, NOW);
  assert.equal(session.ipAddress, "203.0.113.7");
});

test("logout accepts the current token or the one it just replaced", async () => {
  for (const presented of ["hash-2", "hash-1"]) {
    const { session, store } = sessionStore(storedSession());

    await revokeRefreshSession(store, "session-1", presented, NOW);

    assert.deepEqual(session.revokedAt, NOW, presented);
  }

  const { session, store } = sessionStore(storedSession());
  await revokeRefreshSession(store, "session-1", "hash-0", NOW);
  assert.equal(session.revokedAt, null);
});
