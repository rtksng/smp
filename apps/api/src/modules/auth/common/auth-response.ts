import type { AuthTokenPair } from "./auth-token.service";

export function toTokenResponse(pair: AuthTokenPair) {
  return {
    accessToken: pair.accessToken,
    accessTokenExpiresAt: pair.accessTokenExpiresAt,
    accessTokenExpiresInSeconds: pair.accessTokenExpiresInSeconds,
    refreshToken: pair.refreshToken,
    refreshTokenExpiresAt: pair.refreshTokenExpiresAt,
    refreshTokenExpiresInSeconds: pair.refreshTokenExpiresInSeconds,
    tokenType: "Bearer" as const
  };
}
