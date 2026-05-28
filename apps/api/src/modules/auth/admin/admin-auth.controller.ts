import { Body, Controller, Post, Req } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { Request } from "express";
import { getAuthRequestContext } from "../common/request-context";
import { AdminLoginDto } from "../dto/admin-login.dto";
import { LogoutDto, RefreshTokenDto } from "../dto/session-token.dto";
import { AdminAuthService } from "./admin-auth.service";

@ApiTags("Admin auth")
@Controller("auth/admin")
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Login an admin with email and password." })
  @ApiOkResponse({ description: "Admin authenticated with role permissions." })
  @ApiBadRequestResponse({ description: "Invalid login payload." })
  @ApiUnauthorizedResponse({ description: "Invalid admin credentials." })
  login(@Body() dto: AdminLoginDto, @Req() request: Request) {
    return this.adminAuthService.login(dto, getAuthRequestContext(request));
  }

  @Post("refresh")
  @ApiOperation({ summary: "Rotate an admin refresh token." })
  @ApiOkResponse({ description: "New admin token pair issued." })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token." })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.adminAuthService.refresh(dto, getAuthRequestContext(request));
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke an admin refresh session." })
  @ApiOkResponse({ description: "Admin session revoked." })
  @ApiUnauthorizedResponse({ description: "Invalid refresh token." })
  logout(@Body() dto: LogoutDto) {
    return this.adminAuthService.logout(dto);
  }
}
