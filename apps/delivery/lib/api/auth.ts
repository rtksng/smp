import { z } from "zod";
import { apiRequest } from "./client";
import { deliverySessionSchema, tokenPairSchema } from "./schemas";

const requestOtpSchema = z.object({
  expiresAt: z.string().optional(),
  message: z.string().optional()
});

const registrationSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  mobileNumber: z.string(),
  email: z.string().nullable(),
  status: z.string(),
  vehicleNumber: z.string().nullable()
});

export function requestDeliveryOtp(mobileNumber: string) {
  return apiRequest("/auth/delivery/request-otp", requestOtpSchema, {
    body: { mobileNumber },
    method: "POST"
  });
}

export function registerDeliveryPartner(input: {
  fullName: string;
  mobileNumber: string;
  email?: string;
  vehicleNumber?: string;
}) {
  return apiRequest("/auth/delivery/register", registrationSchema, {
    body: input,
    method: "POST"
  });
}

export function verifyDeliveryOtp(input: { mobileNumber: string; otp: string }) {
  return apiRequest("/auth/delivery/verify-otp", deliverySessionSchema, {
    body: input,
    method: "POST"
  });
}

export function refreshDeliveryToken(refreshToken: string) {
  return apiRequest("/auth/delivery/refresh", z.object({ tokens: tokenPairSchema }), {
    body: { refreshToken },
    method: "POST"
  });
}

export function logoutDeliverySession(refreshToken: string) {
  return apiRequest("/auth/delivery/logout", z.object({ loggedOut: z.boolean() }), {
    body: { refreshToken },
    method: "POST"
  });
}
