import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import {
  AuthTokenAudience,
  AuthTokenService
} from "../common/auth-token.service";
import type { AuthenticatedRequest } from "./authenticated-request";
import { extractBearerToken } from "./bearer-token";

@Injectable()
export class DeliveryPartnerJwtGuard implements CanActivate {
  constructor(private readonly authTokenService: AuthTokenService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.auth = await this.authTokenService.verifyAccessToken(
      extractBearerToken(request),
      AuthTokenAudience.DeliveryPartner
    );
    return true;
  }
}
