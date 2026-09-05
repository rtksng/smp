import { z } from "zod";
import { File } from "expo-file-system";
import type {
  DeliveryAssignmentListParams,
  DeliveryIncidentType,
  StatusUpdateInput
} from "./types";
import { apiRequest } from "./client";
import {
  deliveryAssignmentListSchema,
  deliveryAssignmentSchema,
  deliveryCashSummarySchema,
  deliveryDashboardSchema,
  deliveryIncidentListSchema,
  deliveryIncidentSchema,
  deliveryNotificationListSchema,
  deliveryNotificationSchema,
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

export function listAssignments(
  accessToken: string,
  params: DeliveryAssignmentListParams = {}
) {
  const query = buildQuery(params);

  return apiRequest(`/delivery/assignments${query}`, deliveryAssignmentListSchema, {
    accessToken
  });
}

export function revokeMyDevices(accessToken: string) {
  return apiRequest(
    "/delivery/me/devices",
    z.object({ revokedDevices: z.number() }),
    { accessToken, method: "DELETE" }
  );
}

export function updateMyProfile(
  accessToken: string,
  input: { fullName: string; email: string | null; vehicleNumber: string | null }
) {
  return apiRequest("/delivery/me", deliveryPartnerProfileSchema, {
    accessToken,
    body: input,
    method: "PATCH"
  });
}

export function getAssignment(accessToken: string, assignmentId: string) {
  return apiRequest(
    `/delivery/assignments/${assignmentId}`,
    deliveryAssignmentSchema,
    { accessToken }
  );
}

export function getDeliveryDashboard(accessToken: string) {
  return apiRequest("/delivery/dashboard", deliveryDashboardSchema, {
    accessToken
  });
}

export function getCashSummary(accessToken: string) {
  return apiRequest("/delivery/cash", deliveryCashSummarySchema, { accessToken });
}

export function listNotifications(accessToken: string) {
  return apiRequest("/delivery/notifications", deliveryNotificationListSchema, {
    accessToken
  });
}

export function markNotificationRead(accessToken: string, notificationId: string) {
  return apiRequest(
    `/delivery/notifications/${notificationId}/read`,
    deliveryNotificationSchema,
    { accessToken, method: "PATCH" }
  );
}

export function markAllNotificationsRead(accessToken: string) {
  return apiRequest(
    "/delivery/notifications/read-all",
    z.object({ markedRead: z.number() }),
    { accessToken, method: "PATCH" }
  );
}

export function listIncidents(accessToken: string) {
  return apiRequest("/delivery/incidents", deliveryIncidentListSchema, {
    accessToken
  });
}

export function createIncident(
  accessToken: string,
  assignmentId: string,
  input: {
    type: DeliveryIncidentType;
    note?: string;
    photoUrl?: string;
    photoKey?: string;
  }
) {
  return apiRequest(
    `/delivery/assignments/${assignmentId}/incidents`,
    deliveryIncidentSchema,
    { accessToken, body: input, method: "POST" }
  );
}

export function getSupportContact(accessToken: string) {
  return apiRequest(
    "/delivery/support",
    z.object({ email: z.string().nullable(), phone: z.string().nullable() }),
    { accessToken }
  );
}

export function addPartnerDocument(
  accessToken: string,
  input: { type: string; title: string; fileUrl: string; fileKey: string }
) {
  return apiRequest("/delivery/me/documents", deliveryPartnerProfileSchema, {
    accessToken,
    body: input,
    method: "POST"
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
  return uploadFile(accessToken, "/delivery-partner/uploads/proof", file);
}

export function uploadPartnerDocument(
  accessToken: string,
  file: { uri: string; name: string; type: string }
) {
  return uploadFile(accessToken, "/delivery-partner/uploads/document", file);
}

function uploadFile(
  accessToken: string,
  path: string,
  file: { uri: string; name: string; type: string }
) {
  const formData = new FormData();
  // Expo's fetch accepts File/Blob parts, not React Native URI descriptor objects.
  formData.append("file", new File(file.uri), file.name);

  return apiRequest(path, uploadResponseSchema, {
    accessToken,
    body: formData,
    method: "POST"
  });
}

function buildQuery(params: DeliveryAssignmentListParams) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== ""
  );

  return entries.length === 0
    ? ""
    : `?${entries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join("&")}`;
}
