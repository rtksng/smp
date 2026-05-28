import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
