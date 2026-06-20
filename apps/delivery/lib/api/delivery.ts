import { z } from "zod";
import type { StatusUpdateInput } from "./types";
import { apiRequest } from "./client";
import {
  deliveryAssignmentListSchema,
  deliveryAssignmentSchema,
  deliveryPartnerProfileSchema
} from "./schemas";

const uploadResponseSchema = z.object({
  key: z.string(),
  mimeType: z.string(),
  size: z.number(),
  url: z.string()
});

export function getMyProfile(accessToken: string) {
  return apiRequest("/delivery/me", deliveryPartnerProfileSchema, {
    accessToken
  });
}

export function updateOnlineStatus(accessToken: string, isOnline: boolean) {
  return apiRequest("/delivery/me/status", deliveryPartnerProfileSchema, {
    accessToken,
    body: { isOnline },
    method: "PATCH"
  });
}

export function updateLocation(
  accessToken: string,
  input: { latitude: number; longitude: number }
) {
  return apiRequest("/delivery/me/location", deliveryPartnerProfileSchema, {
    accessToken,
    body: input,
    method: "POST"
  });
}

export function registerDevice(
  accessToken: string,
  input: {
    platform: "ios" | "android";
    pushToken: string;
    notificationsEnabled?: boolean;
  }
) {
  return apiRequest("/delivery/me/device", z.unknown(), {
    accessToken,
    body: input,
    method: "PATCH"
  });
}

export function listAssignments(accessToken: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";

  return apiRequest(`/delivery/assignments${query}`, deliveryAssignmentListSchema, {
    accessToken
  });
}

export function updateAssignmentStatus(
  accessToken: string,
  assignmentId: string,
  input: StatusUpdateInput
) {
  return apiRequest(
    `/delivery/assignments/${assignmentId}/status`,
    deliveryAssignmentSchema,
    {
      accessToken,
      body: input,
      method: "PATCH"
    }
  );
}

export function uploadDeliveryProof(
  accessToken: string,
  file: {
    uri: string;
    name: string;
    type: string;
  }
) {
  const formData = new FormData();
  formData.append("file", file as unknown as Blob);

  return apiRequest("/delivery-partner/uploads/proof", uploadResponseSchema, {
    accessToken,
    body: formData,
    method: "POST"
  });
}
