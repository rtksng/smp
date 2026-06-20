import type { DeliveryAssignment, DeliveryStatus } from "./types";

export const ACTIVE_STATUSES: DeliveryStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY"
];

export function nextStatuses(status: DeliveryStatus): DeliveryStatus[] {
  switch (status) {
    case "ASSIGNED":
      return ["ACCEPTED", "CANCELLED"];
    case "ACCEPTED":
      return ["PICKED_UP", "CANCELLED"];
    case "PICKED_UP":
      return ["OUT_FOR_DELIVERY", "FAILED"];
    case "OUT_FOR_DELIVERY":
      return ["DELIVERED", "FAILED"];
    default:
      return [];
  }
}

export function statusLabel(status: DeliveryStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function isCodAssignment(assignment: DeliveryAssignment) {
  return assignment.payment.method === "COD" && assignment.payment.codAmount > 0;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export function assignmentDestination(assignment: DeliveryAssignment) {
  const address = assignment.shippingAddress;

  if (!address) {
    return assignment.customer.fullName;
  }

  return [
    address.line1,
    address.line2,
    address.landmark,
    address.city,
    address.state,
    address.pincode
  ]
    .filter(Boolean)
    .join(", ");
}
