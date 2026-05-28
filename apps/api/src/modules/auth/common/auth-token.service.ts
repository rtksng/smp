import { createHash } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

export enum AuthTokenAudience {
  Admin = "admin",
  Customer = "customer",
  DeliveryPartner = "delivery_partner"
}

export type AuthTokenOptions = {
  accessSecret: string;
  accessTtlSeconds: number;
  refreshSecret: string;
  refreshTtlSeconds: number;
};

export type IssueTokenPairInput = {
  audience: AuthTokenAudience;
  permissions?: string[];
  role?: string;
  sessionId: string;
  subject: string;
};

export type AuthJwtPayload = {
  audience: AuthTokenAudience;
  permissions?: string[];
  role?: string;
  sessionId: string;
  sub: string;
  tokenType: "access" | "refresh";
};

export type AuthTokenPair = {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresInSeconds: number;
  refreshTokenExpiresAt: Date;
};

function isTokenOptions(value: ConfigService | AuthTokenOptions) {
  return "accessSecret" in value;
}

function secondsFromNow(seconds: number) {
  return new Date(Date.now() + seconds * 1000);
}

@Injectable()
export class AuthTokenService {
  private readonly jwtService: JwtService;
  private readonly options: AuthTokenOptions;

  constructor(
    @Inject(ConfigService) configOrOptions: ConfigService | AuthTokenOptions,
    jwtService?: JwtService
  ) {
    this.jwtService = jwtService ?? new JwtService();

    if (isTokenOptions(configOrOptions)) {
      this.options = configOrOptions;
      return;
    }

    this.options = {
      accessSecret: configOrOptions.getOrThrow<string>("jwtAccessSecret"),
      accessTtlSeconds:
        configOrOptions.get<number>("jwtAccessTtlSeconds") ?? 900,
      refreshSecret: configOrOptions.getOrThrow<string>("jwtRefreshSecret"),
      refreshTtlSeconds:
        configOrOptions.get<number>("jwtRefreshTtlSeconds") ?? 2_592_000
    };
  }

  async issueTokenPair(input: IssueTokenPairInput): Promise<AuthTokenPair> {
    const accessPayload: AuthJwtPayload = {
      audience: input.audience,
      permissions: input.permissions,
      role: input.role,
      sessionId: input.sessionId,
      sub: input.subject,
      tokenType: "access"
    };
    const refreshPayload: AuthJwtPayload = {
      ...accessPayload,
      tokenType: "refresh"
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: this.options.accessTtlSeconds,
      secret: this.options.accessSecret
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: this.options.refreshTtlSeconds,
      secret: this.options.refreshSecret
    });

    return {
      accessToken,
      accessTokenExpiresAt: secondsFromNow(this.options.accessTtlSeconds),
      accessTokenExpiresInSeconds: this.options.accessTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt: secondsFromNow(this.options.refreshTtlSeconds),
      refreshTokenExpiresInSeconds: this.options.refreshTtlSeconds
    };
  }

  async verifyAccessToken(
    token: string,
    audience: AuthTokenAudience
  ): Promise<AuthJwtPayload> {
    return this.verifyToken(token, audience, "access", this.options.accessSecret);
  }

  async verifyRefreshToken(
    token: string,
    audience: AuthTokenAudience
  ): Promise<AuthJwtPayload> {
    return this.verifyToken(
      token,
      audience,
      "refresh",
      this.options.refreshSecret
    );
  }

  hashRefreshToken(refreshToken: string) {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  private async verifyToken(
    token: string,
    audience: AuthTokenAudience,
    tokenType: "access" | "refresh",
    secret: string
  ) {
    try {
      const payload = await this.jwtService.verifyAsync<AuthJwtPayload>(token, {
        secret
      });

      if (payload.audience !== audience) {
        throw new UnauthorizedException("Invalid token audience.");
      }

      if (payload.tokenType !== tokenType) {
        throw new UnauthorizedException("Invalid token type.");
      }

      return payload;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid or expired token.");
    }
  }
}
