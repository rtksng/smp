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
  DeliveryPartnerRequestOtpDto,
  DeliveryPartnerRegisterDto,
  DeliveryPartnerVerifyOtpDto
} from "../dto/delivery-partner-login.dto";
import { LogoutDto, RefreshTokenDto } from "../dto/session-token.dto";
import { DeliveryPartnerAuthService } from "./delivery-partner-auth.service";

@ApiTags("Delivery partner auth")
@Controller("auth/delivery")
export class DeliveryPartnerAuthController {
  constructor(
    private readonly deliveryPartnerAuthService: DeliveryPartnerAuthService
  ) {}

  @Post("request-otp")
  @ApiOperation({
    summary: "Request a delivery partner OTP for the future delivery mobile app."
  })
  @ApiOkResponse({ description: "OTP generated and sent through mock sender." })
  @ApiBadRequestResponse({ description: "Invalid mobile number." })
  @ApiResponse({ description: "OTP rate limit or cooldown exceeded.", status: 429 })
  requestOtp(@Body() dto: DeliveryPartnerRequestOtpDto) {
    return this.deliveryPartnerAuthService.requestOtp(dto);
  }

  @Post("register")
  @ApiOperation({
    summary: "Register a delivery partner application for admin approval."
  })
  @ApiOkResponse({ description: "Delivery partner application created." })
  @ApiBadRequestResponse({ description: "Delivery partner is already registered." })
  register(@Body() dto: DeliveryPartnerRegisterDto) {
    return this.deliveryPartnerAuthService.registerPartner(dto);
  }

  @Post("verify-otp")
  @ApiOperation({
    summary: "Verify delivery partner OTP and issue mobile-app API tokens."
  })
  @ApiOkResponse({ description: "Delivery partner authenticated." })
  @ApiUnauthorizedResponse({
    description: "Invalid OTP or inactive delivery partner."
  })
  verifyOtp(@Body() dto: DeliveryPartnerVerifyOtpDto, @Req() request: Request) {
    return this.deliveryPartnerAuthService.verifyOtp(
      dto,
      getAuthRequestContext(request)
    );
  }

  @Post("refresh")
  @ApiOperation({ summary: "Rotate a delivery partner refresh token." })
  @ApiOkResponse({ description: "New delivery partner token pair issued." })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token." })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.deliveryPartnerAuthService.refresh(
      dto,
      getAuthRequestContext(request)
    );
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke a delivery partner refresh session." })
  @ApiOkResponse({ description: "Delivery partner session revoked." })
  @ApiUnauthorizedResponse({ description: "Invalid refresh token." })
  logout(@Body() dto: LogoutDto) {
    return this.deliveryPartnerAuthService.logout(dto);
  }
}
