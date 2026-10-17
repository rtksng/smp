import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { API_VERSION_PREFIX } from "@surgical/config";
import type { Request, Response } from "express";
import { AUTH_THROTTLE_LIMITS } from "../common/auth-throttle";
import {
  ADMIN_REFRESH_COOKIE,
  clearRefreshCookie,
  readCookie,
  setRefreshCookie,
  withoutRefreshToken
} from "../common/refresh-cookie";
import { getAuthRequestContext } from "../common/request-context";
import { AdminLoginDto } from "../dto/admin-login.dto";
import { AdminAuthService } from "./admin-auth.service";

@ApiTags("Admin auth")
@Controller("auth/admin")
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post("login")
  @Throttle({ default: AUTH_THROTTLE_LIMITS.login })
  @ApiOperation({ summary: "Login an admin with email and password." })
  @ApiOkResponse({ description: "Admin authenticated with role permissions." })
  @ApiBadRequestResponse({ description: "Invalid login payload." })
  @ApiUnauthorizedResponse({ description: "Invalid admin credentials." })
  async login(
    @Body() dto: AdminLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.adminAuthService.login(dto, getAuthRequestContext(request));

    return { ...result, tokens: deliverRefreshToken(response, result.tokens) };
  }

  @Post("refresh")
  @ApiOperation({ summary: "Rotate an admin refresh token." })
  @ApiOkResponse({ description: "New admin token pair issued." })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token." })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.adminAuthService.refresh(
      readCookie(request, ADMIN_REFRESH_COOKIE),
      getAuthRequestContext(request)
    );

    return { ...result, tokens: deliverRefreshToken(response, result.tokens) };
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke an admin refresh session." })
  @ApiOkResponse({ description: "Admin session revoked." })
  @ApiUnauthorizedResponse({ description: "Invalid refresh token." })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.adminAuthService.logout(
      readCookie(request, ADMIN_REFRESH_COOKIE)
    );

    clearRefreshCookie(response, ADMIN_REFRESH_COOKIE, COOKIE_OPTIONS);

    return result;
  }
}

// The admin dashboard only runs in browsers, so its refresh token lives only
// in this httpOnly cookie, scoped to the admin auth routes.
const COOKIE_OPTIONS = {
  path: `${API_VERSION_PREFIX}/auth/admin`,
  sameSite: "strict"
} as const;

function deliverRefreshToken<
  T extends { refreshToken: string; refreshTokenExpiresAt: Date }
>(response: Response, tokens: T) {
  setRefreshCookie(
    response,
    ADMIN_REFRESH_COOKIE,
    tokens.refreshToken,
    tokens.refreshTokenExpiresAt,
    COOKIE_OPTIONS
  );

  return withoutRefreshToken(tokens);
}
