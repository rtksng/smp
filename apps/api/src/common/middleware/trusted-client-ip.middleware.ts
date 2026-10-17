import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TRUSTED_PROXY_HEADERS } from "@surgical/config";
import type { NextFunction, Request, Response } from "express";

// The web and admin apps can proxy browser calls through their own servers.
// Those calls arrive from the frontend host's IP, so the proxy forwards the
// real client IP together with a shared secret. When the secret matches, the
// forwarded IP replaces req.ip for the rate limiter, request logs and audit
// records. Without a configured secret, req.ip is left untouched.
@Injectable()
export class TrustedClientIpMiddleware implements NestMiddleware {
  private readonly proxySecret?: Buffer;

  constructor(configService: ConfigService) {
    const secret = configService.get<string>("apiProxySharedSecret");
    this.proxySecret = secret ? Buffer.from(secret) : undefined;
  }

  use(request: Request, _response: Response, next: NextFunction) {
    const clientIp = this.trustedClientIp(request);

    if (clientIp) {
      // Shadows Express's req.ip getter for this request only.
      Object.defineProperty(request, "ip", {
        configurable: true,
        enumerable: true,
        value: clientIp
      });
    }

    next();
  }

  private trustedClientIp(request: Request) {
    if (!this.proxySecret) {
      return undefined;
    }

    const presentedKey = singleHeader(request.headers[TRUSTED_PROXY_HEADERS.proxyKey]);
    const clientIp = singleHeader(request.headers[TRUSTED_PROXY_HEADERS.clientIp])?.trim();

    if (!presentedKey || !clientIp || isIP(clientIp) === 0) {
      return undefined;
    }

    const presented = Buffer.from(presentedKey);

    if (
      presented.length !== this.proxySecret.length ||
      !timingSafeEqual(presented, this.proxySecret)
    ) {
      return undefined;
    }

    return clientIp;
  }
}

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
