import { ACTIVE_STATUSES, statusLabel } from "../api/status";
import type { DeliveryAssignment, DeliveryStatus } from "../api/types";

export type DeliveryStatusFilter = DeliveryStatus | "ALL";

const FILTER_STATUSES: DeliveryStatusFilter[] = [
  "ALL",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED"
];

export function countAssignmentsByStatus(assignments: DeliveryAssignment[]) {
  const counts = Object.fromEntries(
    FILTER_STATUSES.filter((status) => status !== "ALL").map((status) => [
      status,
      0
    ])
  ) as Record<DeliveryStatus, number>;

  for (const assignment of assignments) {
    counts[assignment.status] += 1;
  }

  return counts;
}

export function dashboardMetrics(assignments: DeliveryAssignment[]) {
  return assignments.reduce(
    (metrics, assignment) => {
      metrics.totalCount += 1;

      if (ACTIVE_STATUSES.includes(assignment.status)) {
        metrics.activeCount += 1;
      }

      if (assignment.status === "DELIVERED") {
        metrics.completedCount += 1;
      }

      if (assignment.status === "FAILED" || assignment.status === "CANCELLED") {
        metrics.issueCount += 1;
      }

      if (
        ACTIVE_STATUSES.includes(assignment.status) &&
        assignment.payment.method === "COD"
      ) {
        metrics.codAmount += assignment.payment.codAmount;
      }

      return metrics;
    },
    {
      activeCount: 0,
      codAmount: 0,
      completedCount: 0,
      issueCount: 0,
      totalCount: 0
    }
  );
}

export function deliveryFilterOptions(assignments: DeliveryAssignment[]) {
  const counts = countAssignmentsByStatus(assignments);

  return FILTER_STATUSES.map((status) => ({
    count: status === "ALL" ? assignments.length : counts[status],
    label: status === "ALL" ? "All" : statusLabel(status),
    status
  }));
}

export function deliveryFilterOptionsFromCounts(
  counts: Record<DeliveryStatus, number>,
  total: number
) {
  return FILTER_STATUSES.map((status) => ({
    count: status === "ALL" ? total : counts[status],
    label: status === "ALL" ? "All" : statusLabel(status),
    status
  }));
}

export function nextActionLabel(status: DeliveryStatus) {
  switch (status) {
    case "ASSIGNED":
      return "Accept order";
    case "ACCEPTED":
      return "Mark picked up";
    case "PICKED_UP":
      return "Start delivery";
    case "OUT_FOR_DELIVERY":
      return "Complete delivery";
    case "DELIVERED":
      return "Completed";
    case "FAILED":
      return "Issue logged";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
