import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
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
  DeliveryPartnerRegisterDto,
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

  async registerPartner(dto: DeliveryPartnerRegisterDto) {
    const mobileNumber = normalizeRequiredText(dto.mobileNumber, "Mobile number");
    const email = normalizeNullableEmail(dto.email);
    const existingPartner = await this.prisma.deliveryPartner.findFirst({
      where: {
        deletedAt: null,
        OR: stripUndefined([
          {
            mobileNumber
          },
          email
            ? {
                email
              }
            : undefined
        ])
      }
    });

    if (existingPartner) {
      if (
        existingPartner.mobileNumber === mobileNumber &&
        existingPartner.status === DeliveryPartnerStatus.INACTIVE
      ) {
        const resubmitted = await this.prisma.deliveryPartner.update({
          data: {
            email,
            fullName: normalizeRequiredText(dto.fullName, "Full name"),
            status: DeliveryPartnerStatus.PENDING_VERIFICATION,
            statusReason: null,
            vehicleNumber: normalizeNullableVehicle(dto.vehicleNumber)
          },
          where: { id: existingPartner.id }
        });

        return {
          email: resubmitted.email,
          fullName: resubmitted.fullName,
          id: resubmitted.id,
          mobileNumber: resubmitted.mobileNumber,
          status: resubmitted.status,
          vehicleNumber: resubmitted.vehicleNumber
        };
      }

      throw new BadRequestException("Delivery partner is already registered.");
    }

    const deliveryPartner = await this.prisma.deliveryPartner.create({
      data: {
        email,
        fullName: normalizeRequiredText(dto.fullName, "Full name"),
        mobileNumber,
        status: DeliveryPartnerStatus.PENDING_VERIFICATION,
        vehicleNumber: normalizeNullableVehicle(dto.vehicleNumber)
      }
    });

    return {
      email: deliveryPartner.email,
      fullName: deliveryPartner.fullName,
      id: deliveryPartner.id,
      mobileNumber: deliveryPartner.mobileNumber,
      status: deliveryPartner.status,
      vehicleNumber: deliveryPartner.vehicleNumber
    };
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

  async getApplicationStatus(id: string) {
    const application = await this.prisma.deliveryPartner.findFirst({
      select: {
        id: true,
        status: true,
        statusReason: true,
        updatedAt: true
      },
      where: {
        deletedAt: null,
        id
      }
    });

    if (!application) {
      throw new NotFoundException("Delivery partner application was not found.");
    }

    return application;
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

function normalizeRequiredText(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException(`${label} is required.`);
  }

  return trimmed;
}

function normalizeNullableEmail(value?: string | null) {
  const trimmed = value?.trim().toLowerCase() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableVehicle(value?: string | null) {
  const trimmed = value?.trim().toUpperCase() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function stripUndefined<T>(items: Array<T | undefined>) {
  return items.filter((item): item is T => item !== undefined);
}
