import { UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "./authenticated-request";

export function extractBearerToken(request: AuthenticatedRequest) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new UnauthorizedException("Bearer token is required.");
  }

  return authorization.slice("Bearer ".length).trim();
}
