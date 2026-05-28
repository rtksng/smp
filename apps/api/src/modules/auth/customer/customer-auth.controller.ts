import { Body, Controller, Post, Req } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { Request } from "express";
import { getAuthRequestContext } from "../common/request-context";
import {
  CustomerRequestOtpDto,
  CustomerVerifyOtpDto
} from "../dto/customer-login.dto";
import { LogoutDto, RefreshTokenDto } from "../dto/session-token.dto";
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
  verifyOtp(@Body() dto: CustomerVerifyOtpDto, @Req() request: Request) {
    return this.customerAuthService.verifyOtp(
      dto,
      getAuthRequestContext(request)
    );
  }

  @Post("refresh")
  @ApiOperation({ summary: "Rotate a customer refresh token." })
  @ApiOkResponse({ description: "New customer token pair issued." })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token." })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.customerAuthService.refresh(dto, getAuthRequestContext(request));
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke a customer refresh session." })
  @ApiOkResponse({ description: "Customer session revoked." })
  @ApiUnauthorizedResponse({ description: "Invalid refresh token." })
  logout(@Body() dto: LogoutDto) {
    return this.customerAuthService.logout(dto);
  }
}
