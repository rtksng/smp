import { z } from "zod";
import { normalizeIndianMobileNumber } from "../auth/mobile";
import { requestApi } from "./client";

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

export async function refreshCustomerTokens(refreshToken?: string | null) {
  const data = await requestApi("/auth/customer/refresh", customerRefreshResponseSchema, {
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    credentials: "include",
    method: "POST"
  });

  return data.tokens;
}

export function logoutCustomerSession(refreshToken?: string | null) {
  return requestApi("/auth/customer/logout", customerLogoutResponseSchema, {
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    credentials: "include",
    method: "POST"
  });
}
