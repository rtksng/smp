import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { Response } from "express";
import { AUTH_THROTTLE_LIMITS } from "../common/auth-throttle";
import {
  clearRefreshCookie,
  CUSTOMER_REFRESH_COOKIE,
  isBrowserRequest,
  readCookie,
  setRefreshCookie,
  withoutRefreshToken
} from "../common/refresh-cookie";
import { getAuthRequestContext } from "../common/request-context";
import {
  CustomerRequestOtpDto,
  CustomerVerifyOtpDto
} from "../dto/customer-login.dto";
import {
  OptionalLogoutDto,
  OptionalRefreshTokenDto
} from "../dto/session-token.dto";
import { CustomerAuthService } from "./customer-auth.service";

@ApiTags("Customer auth")
@Controller("auth/customer")
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  @Post("request-otp")
  @Throttle({ default: AUTH_THROTTLE_LIMITS.otpRequest })
  @ApiOperation({ summary: "Request a customer login OTP." })
  @ApiOkResponse({ description: "OTP generated and sent through mock sender." })
  @ApiBadRequestResponse({ description: "Invalid mobile number." })
  @ApiResponse({ description: "OTP rate limit or cooldown exceeded.", status: 429 })
  requestOtp(@Body() dto: CustomerRequestOtpDto) {
    return this.customerAuthService.requestOtp(dto);
  }

  @Post("verify-otp")
  @Throttle({ default: AUTH_THROTTLE_LIMITS.otpVerify })
  @ApiOperation({ summary: "Verify customer OTP and issue tokens." })
  @ApiOkResponse({ description: "Customer authenticated." })
  @ApiUnauthorizedResponse({ description: "Invalid or expired OTP." })
  async verifyOtp(
    @Body() dto: CustomerVerifyOtpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.customerAuthService.verifyOtp(
      dto,
      getAuthRequestContext(request)
    );

    return {
      ...result,
      tokens: deliverRefreshToken(request, response, result.tokens)
    };
  }

  @Post("refresh")
  @ApiOperation({ summary: "Rotate a customer refresh token." })
  @ApiOkResponse({ description: "New customer token pair issued." })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token." })
  async refresh(
    @Body() dto: OptionalRefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.customerAuthService.refresh(
      presentedRefreshToken(request, dto),
      getAuthRequestContext(request)
    );

    return {
      ...result,
      tokens: deliverRefreshToken(request, response, result.tokens)
    };
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke a customer refresh session." })
  @ApiOkResponse({ description: "Customer session revoked." })
  @ApiUnauthorizedResponse({ description: "Invalid refresh token." })
  async logout(
    @Body() dto: OptionalLogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.customerAuthService.logout(
      presentedRefreshToken(request, dto)
    );

    if (isBrowserRequest(request)) {
      clearRefreshCookie(response, CUSTOMER_REFRESH_COOKIE, COOKIE_OPTIONS);
    }

    return result;
  }
}

const COOKIE_OPTIONS = { path: "/", sameSite: "lax" } as const;

// Browsers use the httpOnly cookie only; native apps use the body only. The two
// are never mixed, so a browser never sees a refresh token in a response body.
function presentedRefreshToken(request: Request, dto: OptionalRefreshTokenDto) {
  return isBrowserRequest(request)
    ? readCookie(request, CUSTOMER_REFRESH_COOKIE)
    : dto.refreshToken;
}

function deliverRefreshToken<
  T extends { refreshToken: string; refreshTokenExpiresAt: Date }
>(request: Request, response: Response, tokens: T) {
  if (!isBrowserRequest(request)) {
    return tokens;
  }

  setRefreshCookie(
    response,
    CUSTOMER_REFRESH_COOKIE,
    tokens.refreshToken,
    tokens.refreshTokenExpiresAt,
    COOKIE_OPTIONS
  );

  return withoutRefreshToken(tokens);
}
