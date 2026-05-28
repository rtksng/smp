import { randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import {
  AuthTokenAudience,
  AuthTokenService
} from "../common/auth-token.service";
import { toTokenResponse } from "../common/auth-response";
import type { AuthRequestContext } from "../common/request-context";
import { OtpPurpose, OtpService } from "../common/otp.service";
import {
  CustomerRequestOtpDto,
  CustomerVerifyOtpDto
} from "../dto/customer-login.dto";
import { LogoutDto, RefreshTokenDto } from "../dto/session-token.dto";

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService
  ) {}

  requestOtp(dto: CustomerRequestOtpDto) {
    return this.otpService.requestOtp(OtpPurpose.Customer, dto.mobileNumber);
  }

  async verifyOtp(dto: CustomerVerifyOtpDto, context: AuthRequestContext) {
    const verified = await this.otpService.verifyOtp(
      OtpPurpose.Customer,
      dto.mobileNumber,
      dto.otp
    );

    if (!verified) {
      throw new UnauthorizedException("Invalid or expired OTP.");
    }

    const user = await this.prisma.user.upsert({
      create: {
        firstName: "Customer",
        mobileNumber: dto.mobileNumber
      },
      update: {},
      where: {
        mobileNumber: dto.mobileNumber
      }
    });

    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException("Customer account is inactive.");
    }

    const sessionId = randomUUID();
    const tokenPair = await this.authTokenService.issueTokenPair({
      audience: AuthTokenAudience.Customer,
      sessionId,
      subject: user.id
    });

    await this.prisma.userSession.create({
      data: {
        expiresAt: tokenPair.refreshTokenExpiresAt,
        id: sessionId,
        ipAddress: context.ipAddress,
        refreshToken: this.authTokenService.hashRefreshToken(
          tokenPair.refreshToken
        ),
        userAgent: context.userAgent,
        userId: user.id
      }
    });

    return {
      tokens: toTokenResponse(tokenPair),
      user: {
        email: user.email,
        firstName: user.firstName,
        id: user.id,
        lastName: user.lastName,
        mobileNumber: user.mobileNumber
      }
    };
  }

  async refresh(dto: RefreshTokenDto, context: AuthRequestContext) {
    const payload = await this.authTokenService.verifyRefreshToken(
      dto.refreshToken,
      AuthTokenAudience.Customer
    );
    const currentRefreshTokenHash = this.authTokenService.hashRefreshToken(
      dto.refreshToken
    );
    const session = await this.prisma.userSession.findFirst({
      include: {
        user: true
      },
      where: {
        expiresAt: {
          gt: new Date()
        },
        id: payload.sessionId,
        refreshToken: currentRefreshTokenHash,
        revokedAt: null
      }
    });

    if (!session || !session.user.isActive || session.user.deletedAt) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const tokenPair = await this.authTokenService.issueTokenPair({
      audience: AuthTokenAudience.Customer,
      sessionId: session.id,
      subject: session.userId
    });

    await this.prisma.userSession.update({
      data: {
        expiresAt: tokenPair.refreshTokenExpiresAt,
        ipAddress: context.ipAddress,
        refreshToken: this.authTokenService.hashRefreshToken(
          tokenPair.refreshToken
        ),
        userAgent: context.userAgent
      },
      where: {
        id: session.id
      }
    });

    return {
      tokens: toTokenResponse(tokenPair)
    };
  }

  async logout(dto: LogoutDto) {
    const payload = await this.authTokenService.verifyRefreshToken(
      dto.refreshToken,
      AuthTokenAudience.Customer
    );

    await this.prisma.userSession.updateMany({
      data: {
        revokedAt: new Date()
      },
      where: {
        id: payload.sessionId,
        refreshToken: this.authTokenService.hashRefreshToken(dto.refreshToken),
        revokedAt: null
      }
    });

    return {
      loggedOut: true
    };
  }
}
