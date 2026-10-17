import { z } from "zod";
import { normalizeIndianMobileNumber } from "../auth/mobile";
import { ApiClientError, requestApi } from "./client";

export const customerTokenSetSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  accessTokenExpiresInSeconds: z.number(),
  refreshToken: z.string().nullable().optional(),
  refreshTokenExpiresAt: z.string(),
  refreshTokenExpiresInSeconds: z.number(),
  tokenType: z.literal("Bearer")
});

export const customerProfileSchema = z.object({
  email: z.string().nullable(),
  firstName: z.string(),
  id: z.string(),
  lastName: z.string().nullable(),
  mobileNumber: z.string()
});

export const customerOtpRequestSchema = z.object({
  devOtp: z.string().regex(/^\d{6}$/).optional(),
  expiresInSeconds: z.number(),
  mobileNumber: z.string(),
  resendAfterSeconds: z.number()
});

const customerVerifyOtpResponseSchema = z.object({
  tokens: customerTokenSetSchema,
  user: customerProfileSchema
});

const customerRefreshResponseSchema = z.object({
  tokens: customerTokenSetSchema
});

const customerLogoutResponseSchema = z.object({
  loggedOut: z.boolean()
});

export type CustomerTokenSet = z.infer<typeof customerTokenSetSchema>;
export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type CustomerOtpRequest = z.infer<typeof customerOtpRequestSchema>;
export type CustomerSession = {
  customer: CustomerProfile;
  tokens: CustomerTokenSet;
};

export async function requestCustomerOtp(mobileNumber: string) {
  const normalizedMobileNumber = normalizeIndianMobileNumber(mobileNumber);

  return requestApi("/auth/customer/request-otp", customerOtpRequestSchema, {
    body: JSON.stringify({ mobileNumber: normalizedMobileNumber }),
    method: "POST"
  });
}

export async function verifyCustomerOtp(mobileNumber: string, otp: string) {
  const data = await requestApi(
    "/auth/customer/verify-otp",
    customerVerifyOtpResponseSchema,
    {
      body: JSON.stringify({
        mobileNumber: normalizeIndianMobileNumber(mobileNumber),
        otp
      }),
      credentials: "include",
      method: "POST"
    }
  );

  return {
    customer: data.user,
    tokens: data.tokens
  } satisfies CustomerSession;
}

const REFRESH_RETRY_DELAY_MS = 500;
let refreshInFlight: Promise<CustomerTokenSet> | null = null;

// The refresh token is an httpOnly cookie the API rotates on every refresh,
// so callers in this tab share one request: a second request with the old
// cookie would be refused.
export function refreshCustomerTokens(): Promise<CustomerTokenSet> {
  refreshInFlight ??= requestCustomerRefresh().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function requestCustomerRefresh() {
  try {
    return await postCustomerRefresh();
  } catch (error) {
    // Another tab rotated the cookie a moment ago; the browser now holds the
    // new one, so a single retry succeeds.
    if (error instanceof ApiClientError && error.status === 409) {
      await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS));
      return postCustomerRefresh();
    }

    throw error;
  }
}

async function postCustomerRefresh() {
  const data = await requestApi("/auth/customer/refresh", customerRefreshResponseSchema, {
    body: JSON.stringify({}),
    credentials: "include",
    method: "POST"
  });

  return data.tokens;
}

export function logoutCustomerSession() {
  return requestApi("/auth/customer/logout", customerLogoutResponseSchema, {
    body: JSON.stringify({}),
    credentials: "include",
    method: "POST"
  });
}
