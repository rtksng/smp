import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { NextFunction, Request, Response } from "express";
import { TrustedClientIpMiddleware } from "../../src/common/middleware/trusted-client-ip.middleware";
import { getAuthRequestContext } from "../../src/modules/auth/common/request-context";

const PROXY_SECRET = "proxy-secret-with-at-least-32-characters";

function middleware(secret?: string) {
  return new TrustedClientIpMiddleware({
    get: (key: string) => (key === "apiProxySharedSecret" ? secret : undefined)
  } as unknown as ConfigService);
}

// Express defines req.ip as a getter on the request prototype.
function expressRequest(headers: Record<string, string>, socketIp = "10.0.0.1") {
  const prototype = {
    get ip() {
      return socketIp;
    }
  };
  const request = Object.create(prototype) as Request;
  Object.assign(request, { headers });
  return request;
}

function run(instance: TrustedClientIpMiddleware, request: Request) {
  let calledNext = false;
  const next: NextFunction = () => {
    calledNext = true;
  };

  instance.use(request, {} as Response, next);
  assert.equal(calledNext, true);
  return request.ip;
}

test("TrustedClientIpMiddleware uses the forwarded client IP when the proxy key matches", () => {
  const request = expressRequest({
    "x-smp-client-ip": "203.0.113.7",
    "x-smp-proxy-key": PROXY_SECRET
  });

  assert.equal(run(middleware(PROXY_SECRET), request), "203.0.113.7");
});

test("TrustedClientIpMiddleware ignores forwarded IPs without a configured secret", () => {
  const request = expressRequest({
    "x-smp-client-ip": "203.0.113.7",
    "x-smp-proxy-key": PROXY_SECRET
  });

  assert.equal(run(middleware(undefined), request), "10.0.0.1");
});

test("TrustedClientIpMiddleware ignores forwarded IPs with a wrong proxy key", () => {
  const request = expressRequest({
    "x-smp-client-ip": "203.0.113.7",
    "x-smp-proxy-key": "wrong-key"
  });

  assert.equal(run(middleware(PROXY_SECRET), request), "10.0.0.1");
});

test("TrustedClientIpMiddleware ignores forwarded values that are not IP addresses", () => {
  const request = expressRequest({
    "x-smp-client-ip": "203.0.113.7, 198.51.100.1",
    "x-smp-proxy-key": PROXY_SECRET
  });

  assert.equal(run(middleware(PROXY_SECRET), request), "10.0.0.1");
});

test("getAuthRequestContext uses request.ip instead of client-supplied forwarding headers", () => {
  const request = expressRequest(
    {
      "user-agent": "test-agent",
      "x-forwarded-for": "1.2.3.4"
    },
    "198.51.100.9"
  );

  assert.deepEqual(getAuthRequestContext(request), {
    ipAddress: "198.51.100.9",
    userAgent: "test-agent"
  });
});
