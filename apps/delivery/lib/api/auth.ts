import { z } from "zod";
import { apiRequest } from "./client";
import { deliverySessionSchema, tokenPairSchema } from "./schemas";
import type { DeliveryApplication } from "./types";

const requestOtpSchema = z.object({
  devOtp: z.string().regex(/^\d{6}$/).optional(),
  expiresInSeconds: z.number(),
  mobileNumber: z.string(),
  resendAfterSeconds: z.number()
});

const registrationSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  mobileNumber: z.string(),
  email: z.string().nullable(),
  status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "INACTIVE", "SUSPENDED"]),
  vehicleNumber: z.string().nullable()
}) satisfies z.ZodType<DeliveryApplication>;

const applicationStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "INACTIVE", "SUSPENDED"]),
  statusReason: z.string().nullable(),
  updatedAt: z.string()
});

export type DeliveryOtpRequest = z.infer<typeof requestOtpSchema>;

export function requestDeliveryOtp(mobileNumber: string) {
  return apiRequest("/auth/delivery/request-otp", requestOtpSchema, {
    body: { mobileNumber: normalizeIndianMobileNumber(mobileNumber) },
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
    body: {
      ...input,
      mobileNumber: normalizeIndianMobileNumber(input.mobileNumber)
    },
    method: "POST"
  });
}

export function getDeliveryApplicationStatus(applicationId: string) {
  return apiRequest(
    `/auth/delivery/applications/${encodeURIComponent(applicationId)}`,
    applicationStatusSchema
  );
}

export function verifyDeliveryOtp(input: { mobileNumber: string; otp: string }) {
  return apiRequest("/auth/delivery/verify-otp", deliverySessionSchema, {
    body: {
      ...input,
      mobileNumber: normalizeIndianMobileNumber(input.mobileNumber)
    },
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

function normalizeIndianMobileNumber(input: string) {
  const digits = input.replace(/\D/g, "");
  const nationalNumber = toIndianNationalNumber(digits);

  if (!nationalNumber || !/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new Error("Enter a valid 10 digit Indian mobile number.");
  }

  return `+91${nationalNumber}`;
}

function toIndianNationalNumber(digits: string) {
  if (digits.length === 10) {
    return digits;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  return null;
}
