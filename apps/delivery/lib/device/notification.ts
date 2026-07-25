export function getAssignmentIdFromNotificationData(
  data: Record<string, unknown> | undefined
) {
  if (!data) {
    return null;
  }

  const value = data.assignmentId ?? data.deliveryAssignmentId;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}
