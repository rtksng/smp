import { formatCurrency } from "../api/status";
import type {
  DeliveryAssignment,
  DeliveryLedgerEntry,
  DeliveryPartnerPayment
} from "../api/types";

export const PAY_NOT_SET_MESSAGE = "Pay not set yet. Contact delivery operations.";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

const percentFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2
});

type PaymentInput = DeliveryPartnerPayment | null | undefined;

/** One-line description of how the partner is paid, e.g. "₹18,000 per month". */
export function formatPayStructure(payment: PaymentInput) {
  return describePay(payment) ?? PAY_NOT_SET_MESSAGE;
}

/** Explains when earnings reach the wallet, or null when pay is not set. */
export function payCreditNote(payment: PaymentInput) {
  if (!describePay(payment)) {
    return null;
  }

  return payment?.paymentType === "SALARY"
    ? "Salary is credited to your wallet each month by delivery operations."
    : "Commission is credited to your wallet automatically when a delivery is marked delivered.";
}

function describePay(payment: PaymentInput) {
  if (payment?.paymentType === "SALARY" && payment.monthlySalary !== null) {
    return `${formatCurrency(payment.monthlySalary)} per month`;
  }

  if (payment?.paymentType === "COMMISSION" && payment.commissionValue !== null) {
    if (payment.commissionType === "PERCENTAGE") {
      return `${percentFormatter.format(payment.commissionValue)}% of order value per delivery`;
    }

    if (payment.commissionType === "FIXED") {
      return `${formatCurrency(payment.commissionValue)} per delivery`;
    }
  }

  return null;
}

/** Formats a "YYYY-MM" salary period as "Oct 2026", or null when it is not a valid month. */
export function formatSalaryPeriod(period: string | null | undefined) {
  const match = period ? /^(\d{4})-(\d{2})$/.exec(period) : null;
  const year = match?.[1];
  const month = match?.[2] ? MONTH_LABELS[Number(match[2]) - 1] : undefined;

  return year && month ? `${month} ${year}` : null;
}

export function ledgerEntryTitle(
  entry: Pick<DeliveryLedgerEntry, "description" | "salaryPeriod" | "type">
) {
  if (entry.type === "SALARY") {
    const period = formatSalaryPeriod(entry.salaryPeriod);

    return period ? `Salary · ${period}` : "Salary";
  }

  return entry.description;
}

export function isLedgerCredit(entry: Pick<DeliveryLedgerEntry, "type">) {
  return entry.type !== "PAYOUT";
}

/** Signed wallet movement: "+₹61.25" for earnings and salary, "−₹500" for payouts. */
export function formatLedgerAmount(entry: Pick<DeliveryLedgerEntry, "amount" | "type">) {
  return `${isLedgerCredit(entry) ? "+" : "−"}${formatCurrency(Math.abs(entry.amount))}`;
}

/** Commission credited for a completed delivery, or null when there is none to show. */
export function completedDeliveryEarning(
  assignment: Pick<DeliveryAssignment, "earning" | "status">
) {
  return assignment.status === "DELIVERED" && typeof assignment.earning === "number"
    ? assignment.earning
    : null;
}

export function deliveryEarningLabel(
  assignment: Pick<DeliveryAssignment, "earning" | "status">
) {
  const earning = completedDeliveryEarning(assignment);

  return earning === null ? null : `Earned ${formatCurrency(earning)}`;
}
