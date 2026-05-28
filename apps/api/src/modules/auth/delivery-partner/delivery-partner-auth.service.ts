import { randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { DeliveryPartnerStatus } from "../../../generated/prisma/enums";
import {
  AuthTokenAudience,
  AuthTokenService
} from "../common/auth-token.service";
import { toTokenResponse } from "../common/auth-response";
import type { AuthRequestContext } from "../common/request-context";
import { OtpPurpose, OtpService } from "../common/otp.service";
import {
  DeliveryPartnerRequestOtpDto,
  DeliveryPartnerVerifyOtpDto
} from "../dto/delivery-partner-login.dto";
import { LogoutDto, RefreshTokenDto } from "../dto/session-token.dto";

@Injectable()
export class DeliveryPartnerAuthService {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService
  ) {}

  requestOtp(dto: DeliveryPartnerRequestOtpDto) {
    return this.otpService.requestOtp(
      OtpPurpose.DeliveryPartner,
      dto.mobileNumber
    );
  }

  async verifyOtp(
    dto: DeliveryPartnerVerifyOtpDto,
    context: AuthRequestContext
  ) {
    const verified = await this.otpService.verifyOtp(
      OtpPurpose.DeliveryPartner,
      dto.mobileNumber,
      dto.otp
    );

    if (!verified) {
      throw new UnauthorizedException("Invalid or expired OTP.");
    }

    const deliveryPartner = await this.prisma.deliveryPartner.findFirst({
      where: {
        deletedAt: null,
        mobileNumber: dto.mobileNumber,
        status: DeliveryPartnerStatus.ACTIVE
      }
    });

    if (!deliveryPartner) {
      throw new UnauthorizedException("Delivery partner is not active.");
    }

    const sessionId = randomUUID();
    const tokenPair = await this.authTokenService.issueTokenPair({
      audience: AuthTokenAudience.DeliveryPartner,
      sessionId,
      subject: deliveryPartner.id
    });

    await this.prisma.deliveryPartnerSession.create({
      data: {
        deliveryPartnerId: deliveryPartner.id,
        expiresAt: tokenPair.refreshTokenExpiresAt,
        id: sessionId,
        ipAddress: context.ipAddress,
        refreshToken: this.authTokenService.hashRefreshToken(
          tokenPair.refreshToken
        ),
        userAgent: context.userAgent
      }
    });

    return {
      deliveryPartner: {
        fullName: deliveryPartner.fullName,
        id: deliveryPartner.id,
        mobileNumber: deliveryPartner.mobileNumber,
        status: deliveryPartner.status
      },
      tokens: toTokenResponse(tokenPair)
    };
  }

  async refresh(dto: RefreshTokenDto, context: AuthRequestContext) {
    const payload = await this.authTokenService.verifyRefreshToken(
      dto.refreshToken,
      AuthTokenAudience.DeliveryPartner
    );
    const session = await this.prisma.deliveryPartnerSession.findFirst({
      include: {
        deliveryPartner: true
      },
      where: {
        expiresAt: {
          gt: new Date()
        },
        id: payload.sessionId,
        refreshToken: this.authTokenService.hashRefreshToken(dto.refreshToken),
        revokedAt: null
      }
    });

    if (
      !session ||
      session.deliveryPartner.status !== DeliveryPartnerStatus.ACTIVE ||
      session.deliveryPartner.deletedAt
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const tokenPair = await this.authTokenService.issueTokenPair({
      audience: AuthTokenAudience.DeliveryPartner,
      sessionId: session.id,
      subject: session.deliveryPartnerId
    });

    await this.prisma.deliveryPartnerSession.update({
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
      AuthTokenAudience.DeliveryPartner
    );

    await this.prisma.deliveryPartnerSession.updateMany({
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
