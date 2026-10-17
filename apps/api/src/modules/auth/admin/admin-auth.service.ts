import { randomUUID } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { AdminStatus } from "../../../generated/prisma/enums";
import type { Prisma } from "../../../generated/prisma/client";
import {
  AuthTokenAudience,
  AuthTokenService
} from "../common/auth-token.service";
import { toTokenResponse } from "../common/auth-response";
import { PasswordService } from "../common/password.service";
import { RedisCacheService } from "../common/redis-cache.service";
import {
  assertCurrentRefreshToken,
  revokeRefreshSession,
  rotateRefreshToken
} from "../common/refresh-rotation";
import type { AuthRequestContext } from "../common/request-context";
import { AdminLoginDto } from "../dto/admin-login.dto";

// Failed logins per account before it is locked for the rest of the window.
// The per-IP throttle limits how fast any single source can guess.
export const MAX_FAILED_ADMIN_LOGINS = 5;
export const ADMIN_LOGIN_LOCKOUT_SECONDS = 15 * 60;

const ADMIN_WITH_PERMISSIONS = {
  role: {
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  }
} as const satisfies Prisma.AdminUserInclude;

type AdminWithPermissions = Prisma.AdminUserGetPayload<{
  include: typeof ADMIN_WITH_PERMISSIONS;
}>;

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
    private readonly loginAttempts: RedisCacheService
  ) {}

  async login(dto: AdminLoginDto, context: AuthRequestContext) {
    const attemptsKey = `auth:admin-login:failures:${dto.email}`;

    if ((await this.readFailedLogins(attemptsKey)) >= MAX_FAILED_ADMIN_LOGINS) {
      throw new HttpException(
        "Too many failed login attempts. Try again in 15 minutes.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const admin = await this.prisma.adminUser.findFirst({
      include: ADMIN_WITH_PERMISSIONS,
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
      await this.recordFailedLogin(attemptsKey);
      throw new UnauthorizedException("Invalid admin credentials.");
    }

    await this.clearFailedLogins(attemptsKey);

    const profile = toAdminProfile(admin);
    const sessionId = randomUUID();
    const tokenPair = await this.authTokenService.issueTokenPair({
      audience: AuthTokenAudience.Admin,
      permissions: profile.permissions,
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
      admin: profile,
      tokens: toTokenResponse(tokenPair)
    };
  }

  // Also returns the admin's current profile, so the dashboard can restore a
  // session from the refresh cookie without keeping anything in storage.
  async refresh(refreshToken: string | undefined, context: AuthRequestContext) {
    if (!refreshToken) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    const payload = await this.authTokenService.verifyRefreshToken(
      refreshToken,
      AuthTokenAudience.Admin
    );
    const presentedHash = this.authTokenService.hashRefreshToken(refreshToken);
    const session = await this.prisma.adminSession.findFirst({
      include: {
        adminUser: {
          include: ADMIN_WITH_PERMISSIONS
        }
      },
      where: {
        expiresAt: {
          gt: new Date()
        },
        id: payload.sessionId,
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

    await assertCurrentRefreshToken(this.prisma.adminSession, session, presentedHash);

    const profile = toAdminProfile(session.adminUser);
    const tokenPair = await this.authTokenService.issueTokenPair({
      audience: AuthTokenAudience.Admin,
      permissions: profile.permissions,
      role: session.adminUser.role.code,
      sessionId: session.id,
      subject: session.adminUserId
    });

    await rotateRefreshToken(this.prisma.adminSession, {
      context,
      nextExpiresAt: tokenPair.refreshTokenExpiresAt,
      nextHash: this.authTokenService.hashRefreshToken(tokenPair.refreshToken),
      presentedHash,
      sessionId: session.id
    });

    return {
      admin: profile,
      tokens: toTokenResponse(tokenPair)
    };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return {
        loggedOut: true
      };
    }

    const payload = await this.authTokenService.verifyRefreshToken(
      refreshToken,
      AuthTokenAudience.Admin
    );

    await revokeRefreshSession(
      this.prisma.adminSession,
      payload.sessionId,
      this.authTokenService.hashRefreshToken(refreshToken)
    );

    return {
      loggedOut: true
    };
  }

  // The lockout is a second layer behind the per-IP throttle; if Redis is
  // unavailable, logins continue rather than locking every admin out.
  private async readFailedLogins(key: string) {
    try {
      return Number((await this.loginAttempts.get(key)) ?? 0);
    } catch (error) {
      this.logger.warn(`Admin login lockout check skipped: ${errorMessage(error)}`);
      return 0;
    }
  }

  private async recordFailedLogin(key: string) {
    try {
      await this.loginAttempts.increment(key, ADMIN_LOGIN_LOCKOUT_SECONDS);
    } catch (error) {
      this.logger.warn(`Admin login failure was not counted: ${errorMessage(error)}`);
    }
  }

  private async clearFailedLogins(key: string) {
    try {
      await this.loginAttempts.delete(key);
    } catch (error) {
      this.logger.warn(`Admin login failures were not cleared: ${errorMessage(error)}`);
    }
  }
}

function toAdminProfile(admin: AdminWithPermissions) {
  return {
    email: admin.email,
    firstName: admin.firstName,
    id: admin.id,
    lastName: admin.lastName,
    permissions: admin.role.permissions.map(
      (rolePermission) => rolePermission.permission.code
    ),
    role: {
      code: admin.role.code,
      name: admin.role.name
    }
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
