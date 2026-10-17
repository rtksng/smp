import { ConflictException, UnauthorizedException } from "@nestjs/common";
import type { AuthRequestContext } from "./request-context";

// A refresh token presented again this soon after it was rotated is a
// concurrent refresh (two tabs, a retried request), not a stolen copy.
export const REFRESH_REUSE_GRACE_MS = 30_000;

export type RotatableSession = {
  id: string;
  previousRefreshToken: string | null;
  refreshToken: string;
  refreshTokenRotatedAt: Date | null;
};

// The UserSession, AdminSession and DeliveryPartnerSession delegates all
// satisfy this; the helpers only rely on their shared columns.
export type SessionStore = {
  updateMany(args: {
    data: Record<string, unknown>;
    where: Record<string, unknown>;
  }): Promise<{ count: number }>;
};

export class RefreshInProgressException extends ConflictException {
  constructor() {
    super("This session was just refreshed. Retry with the latest token.");
  }
}

// Call before issuing new tokens. Throws when the presented token is not the
// session's current one; an old token that is past the grace window means
// someone else holds a copy, so the session is ended for everyone.
export async function assertCurrentRefreshToken(
  sessions: SessionStore,
  session: RotatableSession,
  presentedHash: string,
  now = new Date()
) {
  if (session.refreshToken === presentedHash) {
    return;
  }

  if (
    session.previousRefreshToken === presentedHash &&
    session.refreshTokenRotatedAt &&
    now.getTime() - session.refreshTokenRotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS
  ) {
    throw new RefreshInProgressException();
  }

  await sessions.updateMany({
    data: { revokedAt: now },
    where: { id: session.id, revokedAt: null }
  });
  throw new UnauthorizedException("Invalid or expired refresh token.");
}

// Replaces the session's token only if it is still the one this request
// presented, so two concurrent refreshes cannot both succeed.
export async function rotateRefreshToken(
  sessions: SessionStore,
  input: {
    context: AuthRequestContext;
    nextExpiresAt: Date;
    nextHash: string;
    presentedHash: string;
    sessionId: string;
  },
  now = new Date()
) {
  const rotated = await sessions.updateMany({
    data: {
      expiresAt: input.nextExpiresAt,
      ipAddress: input.context.ipAddress,
      previousRefreshToken: input.presentedHash,
      refreshToken: input.nextHash,
      refreshTokenRotatedAt: now,
      userAgent: input.context.userAgent
    },
    where: {
      id: input.sessionId,
      refreshToken: input.presentedHash,
      revokedAt: null
    }
  });

  if (rotated.count !== 1) {
    throw new RefreshInProgressException();
  }
}

// Logout accepts the current token or the one it just replaced, so a tab
// that has not seen the newest cookie can still end the session.
export async function revokeRefreshSession(
  sessions: SessionStore,
  sessionId: string,
  presentedHash: string,
  now = new Date()
) {
  await sessions.updateMany({
    data: { revokedAt: now },
    where: {
      OR: [{ refreshToken: presentedHash }, { previousRefreshToken: presentedHash }],
      id: sessionId,
      revokedAt: null
    }
  });
}
