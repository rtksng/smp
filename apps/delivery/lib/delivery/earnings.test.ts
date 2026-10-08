import { describe, expect, test } from "vitest";
import type { DeliveryLedgerEntry, DeliveryPartnerPayment } from "../api/types";
import {
  PAY_NOT_SET_MESSAGE,
  completedDeliveryEarning,
  deliveryEarningLabel,
  formatLedgerAmount,
  formatPayStructure,
  formatSalaryPeriod,
  ledgerEntryTitle,
  payCreditNote
} from "./earnings";

const payNotSet: DeliveryPartnerPayment = {
  commissionType: null,
  commissionValue: null,
  monthlySalary: null,
  paymentType: null
};
const salaryPay: DeliveryPartnerPayment = {
  ...payNotSet,
  monthlySalary: 18000,
  paymentType: "SALARY"
};
const fixedCommissionPay: DeliveryPartnerPayment = {
  ...payNotSet,
  commissionType: "FIXED",
  commissionValue: 50,
  paymentType: "COMMISSION"
};

function ledgerEntry(overrides: Partial<DeliveryLedgerEntry> = {}): DeliveryLedgerEntry {
  return {
    amount: 61.25,
    createdAt: "2026-10-07T10:00:00.000Z",
    deliveryAssignmentId: "assignment-1",
    description: "Commission for ORD-20261007-000001",
    id: "ledger-1",
    reference: "ORD-20261007-000001",
    salaryPeriod: null,
    type: "DELIVERY_EARNING",
    ...overrides
  };
}

describe("pay structure formatting", () => {
  test("describes salary, percentage commission, and fixed commission pay", () => {
    expect(formatPayStructure(salaryPay)).toBe("₹18,000 per month");
    expect(
      formatPayStructure({
        ...payNotSet,
        commissionType: "PERCENTAGE",
        commissionValue: 5,
        paymentType: "COMMISSION"
      })
    ).toBe("5% of order value per delivery");
    expect(
      formatPayStructure({
        ...payNotSet,
        commissionType: "PERCENTAGE",
        commissionValue: 2.5,
        paymentType: "COMMISSION"
      })
    ).toBe("2.5% of order value per delivery");
    expect(formatPayStructure(fixedCommissionPay)).toBe("₹50 per delivery");
  });

  test("asks the partner to contact operations when pay is not set", () => {
    expect(formatPayStructure(payNotSet)).toBe(
      "Pay not set yet. Contact delivery operations."
    );
    expect(formatPayStructure(undefined)).toBe(PAY_NOT_SET_MESSAGE);
    expect(formatPayStructure({ ...payNotSet, paymentType: "SALARY" })).toBe(
      PAY_NOT_SET_MESSAGE
    );
    expect(
      formatPayStructure({
        ...payNotSet,
        commissionValue: 5,
        paymentType: "COMMISSION"
      })
    ).toBe(PAY_NOT_SET_MESSAGE);
  });

  test("explains how earnings are credited only when pay is set", () => {
    expect(payCreditNote(salaryPay)).toContain("each month");
    expect(payCreditNote(fixedCommissionPay)).toContain("automatically");
    expect(payCreditNote(payNotSet)).toBeNull();
    expect(payCreditNote(undefined)).toBeNull();
  });
});

describe("ledger entry formatting", () => {
  test("formats valid salary months and rejects anything else", () => {
    expect(formatSalaryPeriod("2026-10")).toBe("Oct 2026");
    expect(formatSalaryPeriod("2027-01")).toBe("Jan 2027");
    expect(formatSalaryPeriod("2026-13")).toBeNull();
    expect(formatSalaryPeriod("Oct 2026")).toBeNull();
    expect(formatSalaryPeriod(null)).toBeNull();
  });

  test("titles salary entries by month and other entries by description", () => {
    expect(
      ledgerEntryTitle(
        ledgerEntry({ description: "October salary", salaryPeriod: "2026-10", type: "SALARY" })
      )
    ).toBe("Salary · Oct 2026");
    expect(
      ledgerEntryTitle(ledgerEntry({ salaryPeriod: null, type: "SALARY" }))
    ).toBe("Salary");
    expect(ledgerEntryTitle(ledgerEntry())).toBe("Commission for ORD-20261007-000001");
  });

  test("signs earnings and salary as credits and payouts as debits", () => {
    expect(formatLedgerAmount(ledgerEntry())).toBe("+₹61.25");
    expect(formatLedgerAmount(ledgerEntry({ amount: 18000, type: "SALARY" }))).toBe(
      "+₹18,000"
    );
    expect(formatLedgerAmount(ledgerEntry({ amount: 500, type: "PAYOUT" }))).toBe(
      "−₹500"
    );
  });
});

describe("completed delivery earnings", () => {
  test("shows commission only for delivered assignments with a credited amount", () => {
    expect(deliveryEarningLabel({ earning: 61.25, status: "DELIVERED" })).toBe(
      "Earned ₹61.25"
    );
    expect(completedDeliveryEarning({ earning: 61.25, status: "DELIVERED" })).toBe(61.25);
    expect(deliveryEarningLabel({ earning: null, status: "DELIVERED" })).toBeNull();
    expect(
      deliveryEarningLabel({ earning: 61.25, status: "OUT_FOR_DELIVERY" })
    ).toBeNull();
  });
});
