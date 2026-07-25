import { z } from "zod";
import { normalizeIndianMobileNumber } from "../auth/mobile";
import {
  authenticatedCustomerSchema,
  customerSessionSchema,
  tokenSetSchema,
  type CustomerSession
} from "./schemas";
import { requestApi } from "./client";

const otpRequestSchema = z.object({
  devOtp: z.string().regex(/^\d{6}$/).optional(),
  expiresInSeconds: z.number(),
  mobileNumber: z.string(),
  resendAfterSeconds: z.number()
});

const verifyResponseSchema = z.object({
  tokens: tokenSetSchema,
  user: authenticatedCustomerSchema
});

const refreshResponseSchema = z.object({
  tokens: tokenSetSchema
});

export type OtpRequest = z.infer<typeof otpRequestSchema>;

export function requestCustomerOtp(mobileNumber: string) {
  return requestApi("/auth/customer/request-otp", otpRequestSchema, {
    body: { mobileNumber: normalizeIndianMobileNumber(mobileNumber) },
    method: "POST"
  });
}

export async function verifyCustomerOtp(mobileNumber: string, otp: string) {
  const result = await requestApi(
    "/auth/customer/verify-otp",
    verifyResponseSchema,
    {
      body: {
        mobileNumber: normalizeIndianMobileNumber(mobileNumber),
        otp
      },
      method: "POST"
    }
  );

  return customerSessionSchema.parse({
    customer: result.user,
    tokens: result.tokens
  }) satisfies CustomerSession;
}

export async function refreshCustomerSession(session: CustomerSession) {
  const result = await requestApi("/auth/customer/refresh", refreshResponseSchema, {
    body: { refreshToken: session.tokens.refreshToken },
    method: "POST"
  });

  return customerSessionSchema.parse({
    ...session,
    tokens: result.tokens
  });
}

export function logoutCustomer(refreshToken: string) {
  return requestApi(
    "/auth/customer/logout",
    z.object({ loggedOut: z.boolean() }),
    {
      body: { refreshToken },
      method: "POST"
    }
  );
}
