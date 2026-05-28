import type { Request } from "express";
import type { AuthJwtPayload } from "../common/auth-token.service";

export type AuthenticatedRequest = Request & {
  auth?: AuthJwtPayload;
};
