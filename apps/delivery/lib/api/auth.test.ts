import { afterEach, describe, expect, test, vi } from "vitest";

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {}
    }
  }
}));

describe("delivery auth API", () => {
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("returns the development OTP from the request response", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api/v1";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            devOtp: "654321",
            expiresInSeconds: 300,
            mobileNumber: "+919876543210",
            resendAfterSeconds: 60
          },
          meta: {
            method: "POST",
            path: "/api/v1/auth/delivery/request-otp",
            timestamp: "2026-06-25T10:00:00.000Z"
          },
          success: true
        }),
        { status: 200 }
      )
    );
    const { requestDeliveryOtp } = await import("./auth");

    await expect(requestDeliveryOtp("+919876543210")).resolves.toEqual({
      devOtp: "654321",
      expiresInSeconds: 300,
      mobileNumber: "+919876543210",
      resendAfterSeconds: 60
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/auth/delivery/request-otp",
      expect.objectContaining({
        body: JSON.stringify({ mobileNumber: "+919876543210" }),
        method: "POST"
      })
    );
  });

  test("normalizes delivery OTP numbers before calling the backend", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api/v1";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            devOtp: "123456",
            expiresInSeconds: 300,
            mobileNumber: "+919876543210",
            resendAfterSeconds: 60
          },
          success: true
        }),
        { status: 200 }
      )
    );
    const { requestDeliveryOtp } = await import("./auth");

    await requestDeliveryOtp("98765 43210");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/auth/delivery/request-otp",
      expect.objectContaining({
        body: JSON.stringify({ mobileNumber: "+919876543210" })
      })
    );
  });
});
