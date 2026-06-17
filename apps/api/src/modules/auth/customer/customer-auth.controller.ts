import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { Request } from "express";
import type { Response } from "express";
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
  @ApiOperation({ summary: "Request a customer login OTP." })
  @ApiOkResponse({ description: "OTP generated and sent through mock sender." })
  @ApiBadRequestResponse({ description: "Invalid mobile number." })
  @ApiResponse({ description: "OTP rate limit or cooldown exceeded.", status: 429 })
  requestOtp(@Body() dto: CustomerRequestOtpDto) {
    return this.customerAuthService.requestOtp(dto);
  }

  @Post("verify-otp")
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

    setRefreshCookie(response, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);

    return result;
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
      dto,
      getAuthRequestContext(request),
      readCookie(request, CUSTOMER_REFRESH_COOKIE)
    );

    setRefreshCookie(response, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);

    return result;
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
      dto,
      readCookie(request, CUSTOMER_REFRESH_COOKIE)
    );

    clearRefreshCookie(response);

    return result;
  }
}

const CUSTOMER_REFRESH_COOKIE = "surgical_customer_refresh";

function setRefreshCookie(response: Response, refreshToken: string, expires: Date) {
  response.cookie(CUSTOMER_REFRESH_COOKIE, refreshToken, {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function clearRefreshCookie(response: Response) {
  response.clearCookie(CUSTOMER_REFRESH_COOKIE, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .map((entry) => entry.split("="))
    .find(([key]) => key === name)?.[1];
}
