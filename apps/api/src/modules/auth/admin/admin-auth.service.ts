import { randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { AdminStatus } from "../../../generated/prisma/enums";
import {
  AuthTokenAudience,
  AuthTokenService
} from "../common/auth-token.service";
import { toTokenResponse } from "../common/auth-response";
import { PasswordService } from "../common/password.service";
import type { AuthRequestContext } from "../common/request-context";
import { AdminLoginDto } from "../dto/admin-login.dto";
import { LogoutDto, RefreshTokenDto } from "../dto/session-token.dto";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService
  ) {}

  async login(dto: AdminLoginDto, context: AuthRequestContext) {
    const admin = await this.prisma.adminUser.findFirst({
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      },
      where: {
        deletedAt: null,
        email: dto.email,
        status: AdminStatus.ACTIVE
      }
    });

    if (
      !admin ||
      !(await this.passwordService.verify(dto.password, admin.passwordHash))
    ) {
      throw new UnauthorizedException("Invalid admin credentials.");
    }

    const permissionCodes = admin.role.permissions.map(
      (rolePermission) => rolePermission.permission.code
    );
    const sessionId = randomUUID();
    const tokenPair = await this.authTokenService.issueTokenPair({
      audience: AuthTokenAudience.Admin,
      permissions: permissionCodes,
      role: admin.role.code,
      sessionId,
      subject: admin.id
    });

    await this.prisma.$transaction([
      this.prisma.adminSession.create({
        data: {
          adminUserId: admin.id,
          expiresAt: tokenPair.refreshTokenExpiresAt,
          id: sessionId,
          ipAddress: context.ipAddress,
          refreshToken: this.authTokenService.hashRefreshToken(
            tokenPair.refreshToken
          ),
          userAgent: context.userAgent
        }
      }),
      this.prisma.adminUser.update({
        data: {
          lastLoginAt: new Date()
        },
        where: {
          id: admin.id
        }
      })
    ]);

    return {
      admin: {
        email: admin.email,
        firstName: admin.firstName,
        id: admin.id,
        lastName: admin.lastName,
        permissions: permissionCodes,
        role: {
          code: admin.role.code,
          name: admin.role.name
        }
      },
      tokens: toTokenResponse(tokenPair)
    };
  }

  async refresh(dto: RefreshTokenDto, context: AuthRequestContext) {
    const payload = await this.authTokenService.verifyRefreshToken(
      dto.refreshToken,
      AuthTokenAudience.Admin
    );
    const session = await this.prisma.adminSession.findFirst({
      include: {
        adminUser: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
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
      session.adminUser.status !== AdminStatus.ACTIVE ||
      session.adminUser.deletedAt
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const permissionCodes = session.adminUser.role.permissions.map(
      (rolePermission) => rolePermission.permission.code
    );
    const tokenPair = await this.authTokenService.issueTokenPair({
      audience: AuthTokenAudience.Admin,
      permissions: permissionCodes,
      role: session.adminUser.role.code,
      sessionId: session.id,
      subject: session.adminUserId
    });

    await this.prisma.adminSession.update({
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
      AuthTokenAudience.Admin
    );

    await this.prisma.adminSession.updateMany({
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
