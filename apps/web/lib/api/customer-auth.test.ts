import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  refreshCustomerTokens,
  requestCustomerOtp,
  verifyCustomerOtp
} from "./customer-auth";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe("customer auth API", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api/v1";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
  });

  it("requests an OTP with an E.164 Indian mobile number", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            devOtp: "123456",
            expiresInSeconds: 300,
            mobileNumber: "+919876543210",
            resendAfterSeconds: 60
          },
          meta: {
            method: "POST",
            path: "/api/v1/auth/customer/request-otp",
            timestamp: "2026-05-25T10:00:00.000Z"
          },
          success: true
        }),
        { status: 200 }
      )
    );

    await expect(requestCustomerOtp("98765 43210")).resolves.toEqual({
      devOtp: "123456",
      expiresInSeconds: 300,
      mobileNumber: "+919876543210",
      resendAfterSeconds: 60
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://api.example.com/api/v1/auth/customer/request-otp"),
      expect.objectContaining({
        body: JSON.stringify({ mobileNumber: "+919876543210" }),
        method: "POST"
      })
    );
  });

  it("verifies an OTP and returns a customer session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            tokens: {
              accessToken: "access-token",
              accessTokenExpiresAt: "2026-05-25T10:15:00.000Z",
              accessTokenExpiresInSeconds: 900,
              refreshToken: "refresh-token",
              refreshTokenExpiresAt: "2026-06-24T10:00:00.000Z",
              refreshTokenExpiresInSeconds: 2592000,
              tokenType: "Bearer"
            },
            user: {
              email: null,
              firstName: "Customer",
              id: "user_1",
              lastName: null,
              mobileNumber: "+919876543210"
            }
          },
          meta: {
            method: "POST",
            path: "/api/v1/auth/customer/verify-otp",
            timestamp: "2026-05-25T10:00:00.000Z"
          },
          success: true
        }),
        { status: 200 }
      )
    );

    await expect(verifyCustomerOtp("+919876543210", "123456")).resolves.toEqual({
      customer: {
        email: null,
        firstName: "Customer",
        id: "user_1",
        lastName: null,
        mobileNumber: "+919876543210"
      },
      tokens: {
        accessToken: "access-token",
        accessTokenExpiresAt: "2026-05-25T10:15:00.000Z",
        accessTokenExpiresInSeconds: 900,
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: "2026-06-24T10:00:00.000Z",
        refreshTokenExpiresInSeconds: 2592000,
        tokenType: "Bearer"
      }
    });
  });
});

describe("customer token refresh", () => {
  const tokens = {
    accessToken: "fresh-access-token",
    accessTokenExpiresAt: "2099-05-25T10:15:00.000Z",
    accessTokenExpiresInSeconds: 900,
    refreshTokenExpiresAt: "2099-06-24T10:00:00.000Z",
    refreshTokenExpiresInSeconds: 2592000,
    tokenType: "Bearer"
  };
  const meta = { method: "POST", path: "/api/v1/auth/customer/refresh", timestamp: "" };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api/v1";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
  });

  it("shares one cookie-based refresh between concurrent callers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { tokens }, meta, success: true }), { status: 200 })
    );

    const [first, second] = await Promise.all([refreshCustomerTokens(), refreshCustomerTokens()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe("include");
    expect(init.body).toBe("{}");
    expect(first.accessToken).toBe("fresh-access-token");
    expect(second).toBe(first);
  });

  it("retries once when another tab refreshed a moment earlier", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            error: { code: "CONFLICT", message: "This session was just refreshed." },
            meta,
            success: false
          }),
          { status: 409 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { tokens }, meta, success: true }), { status: 200 })
      );

    await expect(refreshCustomerTokens()).resolves.toMatchObject({ accessToken: "fresh-access-token" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
