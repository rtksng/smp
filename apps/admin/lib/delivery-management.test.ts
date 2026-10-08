import { describe, expect, it } from "vitest";
import {
  buildDeliveryAssignmentQuery,
  buildDeliveryLedgerPayload,
  buildDeliveryPartnerPayload,
  buildDeliveryPartnerQuery,
  buildDeliveryStatusPayload,
  createDeliveryLedgerForm,
  createEmptyDeliveryAssignmentFilters,
  createEmptyDeliveryPartnerFilters,
  createEmptyDeliveryPartnerForm,
  deliveryPartnerToFormValues,
  filterPartnersForWarehouse,
  formatDeliveryAmount,
  formatDeliveryLabel,
  formatDeliveryLedgerAmount,
  formatDeliveryLedgerEntryType,
  formatDeliveryPartnerPay,
  formatDeliveryPartnerWarehouses,
  formatSalaryPeriod,
  getCurrentSalaryPeriod,
  getDeliveryLedgerEntryTypes,
  getDeliveryPartnerWarehouseMode,
  getEffectivePickupWarehouseId,
  getNextDeliveryStatuses,
  loadDeliveryOptions,
  validateDeliveryLedgerForm,
  validateDeliveryPartnerForm,
  type AdminDeliveryPartner,
  type DeliveryPartnerFormValues,
  type DeliveryPartnerPayment
} from "./delivery-management";

const noPay: DeliveryPartnerPayment = {
  commissionType: null,
  commissionValue: null,
  monthlySalary: null,
  paymentType: null
};
const salaryPay: DeliveryPartnerPayment = {
  commissionType: null,
  commissionValue: null,
  monthlySalary: 18000,
  paymentType: "SALARY"
};
const warehouse = (id: string, name = `Warehouse ${id}`) => ({
  address: "Plot 1",
  city: "Pune",
  code: id.toUpperCase(),
  contactNumber: "+919000000000",
  contactPerson: "Desk",
  id,
  name,
  pincode: "411001",
  state: "Maharashtra"
});
const partner = (overrides: Partial<AdminDeliveryPartner> = {}): AdminDeliveryPartner => ({
  createdAt: "2026-09-01T10:00:00.000Z",
  documents: [],
  email: null,
  fullName: "Asha Driver",
  id: "partner-1",
  isOnline: false,
  lastSeenAt: null,
  mobileNumber: "+919876543210",
  payment: noPay,
  status: "ACTIVE",
  updatedAt: "2026-09-01T10:00:00.000Z",
  vehicleNumber: null,
  wallet: { balance: 0, currency: "INR", totalEarnings: 0 },
  warehouses: [],
  ...overrides
});
const validForm = (overrides: Partial<DeliveryPartnerFormValues> = {}) => ({
  ...createEmptyDeliveryPartnerForm(["w1"]),
  fullName: " Asha Driver ",
  mobileNumber: "+91 98765-43210",
  ...overrides
});

describe("delivery management helpers", () => {
  it("loads dispatch options beyond the first table page", async () => {
    const pages: number[] = [];
    const items = await loadDeliveryOptions(async (page) => {
      pages.push(page);
      return { items: [page], pagination: { hasNextPage: page < 3, hasPreviousPage: page > 1, page, limit: 1, total: 3, totalPages: 3 } };
    });
    expect(pages).toEqual([1, 2, 3]);
    expect(items).toEqual([1, 2, 3]);
  });
  it("normalizes delivery partner filters into the backend query", () => {
    expect(
      buildDeliveryPartnerQuery(
        {
          search: "  Asha  ",
          status: "PENDING_VERIFICATION"
        },
        2,
        50
      )
    ).toEqual({
      limit: 50,
      page: 2,
      search: "Asha",
      status: "PENDING_VERIFICATION"
    });

    expect(buildDeliveryPartnerQuery(createEmptyDeliveryPartnerFilters())).toEqual({
      limit: 20,
      page: 1
    });
    expect(
      buildDeliveryPartnerQuery({ search: "x".repeat(140), status: "" }).search
    ).toHaveLength(100);
  });

  it("normalizes delivery assignment filters into the backend query", () => {
    expect(
      buildDeliveryAssignmentQuery(
        {
          deliveryPartnerId: "partner-1",
          status: "OUT_FOR_DELIVERY",
          warehouseId: "warehouse-1"
        },
        3
      )
    ).toEqual({
      deliveryPartnerId: "partner-1",
      limit: 20,
      page: 3,
      status: "OUT_FOR_DELIVERY",
      warehouseId: "warehouse-1"
    });

    expect(buildDeliveryAssignmentQuery(createEmptyDeliveryAssignmentFilters())).toEqual({
      limit: 20,
      page: 1
    });
  });

  it("derives delivery status options and trims status payload notes", () => {
    expect(getNextDeliveryStatuses("ASSIGNED")).toEqual(["ACCEPTED", "CANCELLED"]);
    expect(getNextDeliveryStatuses("PICKED_UP")).toEqual([
      "OUT_FOR_DELIVERY",
      "FAILED"
    ]);
    expect(getNextDeliveryStatuses("DELIVERED")).toEqual([]);
    expect(buildDeliveryStatusPayload("FAILED", " Clinic closed ")).toEqual({
      note: "Clinic closed",
      status: "FAILED"
    });
    expect(buildDeliveryStatusPayload("FAILED", " ")).toEqual({
      status: "FAILED"
    });
    expect(formatDeliveryLabel("PENDING_VERIFICATION")).toBe("Pending verification");
  });
});

describe("delivery partner warehouses and dispatch", () => {
  const pune = partner({ id: "p-pune", warehouses: [warehouse("w1", "Pune Central")] });
  const both = partner({ id: "p-both", warehouses: [warehouse("w1"), warehouse("w2")] });
  const none = partner({ id: "p-none" });

  it("uses the chosen pickup warehouse before the order warehouse", () => {
    expect(getEffectivePickupWarehouseId("w2", { warehouseId: "w1" })).toBe("w2");
    expect(getEffectivePickupWarehouseId("", { warehouseId: "w1" })).toBe("w1");
    expect(getEffectivePickupWarehouseId("", { warehouseId: null })).toBeNull();
    expect(getEffectivePickupWarehouseId("", undefined)).toBeNull();
  });

  it("offers only partners linked to the pickup warehouse, or everyone when it is unknown", () => {
    expect(filterPartnersForWarehouse([pune, both, none], "w1").map((item) => item.id)).toEqual([
      "p-pune",
      "p-both"
    ]);
    expect(filterPartnersForWarehouse([pune, both, none], "w2").map((item) => item.id)).toEqual([
      "p-both"
    ]);
    expect(filterPartnersForWarehouse([pune, both, none], "w9")).toEqual([]);
    expect(filterPartnersForWarehouse([pune, both, none], null)).toHaveLength(3);
  });

  it("lists partner warehouses by name and code", () => {
    expect(formatDeliveryPartnerWarehouses(pune.warehouses)).toBe("Pune Central (W1)");
    expect(formatDeliveryPartnerWarehouses([])).toBe("No warehouses");
  });
});

describe("delivery partner pay formatting", () => {
  it("describes salary, percentage, fixed, and missing pay", () => {
    expect(formatDeliveryPartnerPay(salaryPay)).toBe("₹18,000 / month salary");
    expect(
      formatDeliveryPartnerPay({ ...noPay, commissionType: "PERCENTAGE", commissionValue: 5, paymentType: "COMMISSION" })
    ).toBe("5% of order value per delivery");
    expect(
      formatDeliveryPartnerPay({ ...noPay, commissionType: "PERCENTAGE", commissionValue: 2.5, paymentType: "COMMISSION" })
    ).toBe("2.5% of order value per delivery");
    expect(
      formatDeliveryPartnerPay({ ...noPay, commissionType: "FIXED", commissionValue: 50, paymentType: "COMMISSION" })
    ).toBe("₹50 per delivery");
    expect(formatDeliveryPartnerPay(noPay)).toBe("Pay not set");
    expect(formatDeliveryPartnerPay(undefined)).toBe("Pay not set");
    expect(formatDeliveryPartnerPay({ ...noPay, paymentType: "COMMISSION" })).toBe(
      "Commission (rate not set)"
    );
  });

  it("formats rupee amounts without empty paise", () => {
    expect(formatDeliveryAmount(18000)).toBe("₹18,000");
    expect(formatDeliveryAmount(61.25)).toBe("₹61.25");
    expect(formatDeliveryAmount(1250.1)).toBe("₹1,250.10");
  });
});

describe("delivery partner form", () => {
  it("picks the warehouse mode from the admin's warehouse reach", () => {
    expect(getDeliveryPartnerWarehouseMode(true, false)).toBe("multiple");
    expect(getDeliveryPartnerWarehouseMode(true, true)).toBe("multiple");
    expect(getDeliveryPartnerWarehouseMode(false, false)).toBe("single");
    expect(getDeliveryPartnerWarehouseMode(false, true)).toBe("locked");
  });

  it("starts empty and loads an existing partner into form values", () => {
    expect(createEmptyDeliveryPartnerForm(["w1"])).toEqual({
      commissionType: "",
      commissionValue: "",
      email: "",
      fullName: "",
      mobileNumber: "",
      monthlySalary: "",
      paymentType: "",
      vehicleNumber: "",
      warehouseIds: ["w1"]
    });
    expect(
      deliveryPartnerToFormValues(
        partner({
          email: "asha@example.com",
          payment: { ...noPay, commissionType: "FIXED", commissionValue: 50, paymentType: "COMMISSION" },
          vehicleNumber: "MH12AB1234",
          warehouses: [warehouse("w1"), warehouse("w2")]
        })
      )
    ).toEqual({
      commissionType: "FIXED",
      commissionValue: "50",
      email: "asha@example.com",
      fullName: "Asha Driver",
      mobileNumber: "+919876543210",
      monthlySalary: "",
      paymentType: "COMMISSION",
      vehicleNumber: "MH12AB1234",
      warehouseIds: ["w1", "w2"]
    });
  });

  it("requires a name and an E.164 mobile number and checks optional email", () => {
    const options = { canManagePay: false, isEditing: false, warehouseMode: "multiple" as const };

    expect(validateDeliveryPartnerForm(validForm(), options)).toEqual({});
    expect(
      validateDeliveryPartnerForm(
        validForm({ email: "not-an-email", fullName: " ", mobileNumber: "9876543210", warehouseIds: [] }),
        options
      )
    ).toEqual({
      email: "Enter a valid email address, or leave it blank.",
      fullName: "Enter the partner's full name.",
      mobileNumber: "Enter the mobile number with its country code, for example +919876543210.",
      warehouseIds: "Select at least one warehouse."
    });
    expect(validateDeliveryPartnerForm(validForm({ mobileNumber: "" }), options).mobileNumber).toBe(
      "Enter the partner's mobile number."
    );
  });

  it("asks warehouse staff to choose only when they have several warehouses", () => {
    const single = { canManagePay: false, isEditing: false, warehouseMode: "single" as const };

    expect(validateDeliveryPartnerForm(validForm({ warehouseIds: [] }), { ...single, warehouseOptionCount: 1 })).toEqual({});
    expect(validateDeliveryPartnerForm(validForm({ warehouseIds: [] }), { ...single, warehouseOptionCount: 0 })).toEqual({});
    expect(
      validateDeliveryPartnerForm(validForm({ warehouseIds: [] }), { ...single, warehouseOptionCount: 3 }).warehouseIds
    ).toBe("Select the warehouse this partner works from.");
    expect(
      validateDeliveryPartnerForm(validForm({ warehouseIds: [] }), {
        canManagePay: false,
        isEditing: true,
        warehouseMode: "locked"
      })
    ).toEqual({});
  });

  it("validates salary and commission pay only for admins who manage pay", () => {
    const options = { canManagePay: true, isEditing: false, warehouseMode: "multiple" as const };

    expect(validateDeliveryPartnerForm(validForm(), options)).toEqual({});
    expect(validateDeliveryPartnerForm(validForm({ monthlySalary: "0", paymentType: "SALARY" }), options)).toEqual({
      monthlySalary: "Enter a monthly salary greater than 0 with up to 2 decimal places."
    });
    expect(validateDeliveryPartnerForm(validForm({ monthlySalary: "18000.505", paymentType: "SALARY" }), options))
      .toHaveProperty("monthlySalary");
    expect(validateDeliveryPartnerForm(validForm({ paymentType: "COMMISSION" }), options)).toEqual({
      commissionType: "Choose a percentage or fixed commission.",
      commissionValue: "Enter an amount per delivery greater than 0 with up to 2 decimal places."
    });
    expect(
      validateDeliveryPartnerForm(
        validForm({ commissionType: "PERCENTAGE", commissionValue: "101", paymentType: "COMMISSION" }),
        options
      )
    ).toEqual({ commissionValue: "Enter a percentage from 0.01 to 100 with up to 2 decimal places." });
    expect(
      validateDeliveryPartnerForm(
        validForm({ commissionType: "PERCENTAGE", commissionValue: "100", paymentType: "COMMISSION" }),
        options
      )
    ).toEqual({});
    expect(
      validateDeliveryPartnerForm(validForm({ monthlySalary: "", paymentType: "SALARY" }), {
        ...options,
        canManagePay: false
      })
    ).toEqual({});
  });

  it("builds a create body with warehouses and pay only when the admin may send them", () => {
    const values = validForm({
      email: " Asha@Example.com ",
      monthlySalary: "18000",
      paymentType: "SALARY",
      vehicleNumber: " mh12ab1234 ",
      warehouseIds: ["w1", "w2", "w1"]
    });

    expect(
      buildDeliveryPartnerPayload(values, { canManagePay: true, isEditing: false, warehouseMode: "multiple" })
    ).toStrictEqual({
      email: "asha@example.com",
      fullName: "Asha Driver",
      mobileNumber: "+919876543210",
      monthlySalary: 18000,
      paymentType: "SALARY",
      vehicleNumber: "MH12AB1234",
      warehouseIds: ["w1", "w2"]
    });
    expect(
      buildDeliveryPartnerPayload(
        validForm({ monthlySalary: "18000", paymentType: "SALARY", warehouseIds: ["w2"] }),
        { canManagePay: false, isEditing: false, warehouseMode: "single" }
      )
    ).toStrictEqual({
      fullName: "Asha Driver",
      mobileNumber: "+919876543210",
      warehouseIds: ["w2"]
    });
    expect(
      buildDeliveryPartnerPayload(validForm({ warehouseIds: [] }), {
        canManagePay: false,
        isEditing: false,
        warehouseMode: "single"
      })
    ).toStrictEqual({ fullName: "Asha Driver", mobileNumber: "+919876543210" });
  });

  it("builds an edit body that clears blank contact fields and never sends locked warehouses", () => {
    expect(
      buildDeliveryPartnerPayload(
        validForm({
          commissionType: "PERCENTAGE",
          commissionValue: "5",
          paymentType: "COMMISSION",
          warehouseIds: ["w1"]
        }),
        { canManagePay: true, isEditing: true, warehouseMode: "locked" }
      )
    ).toStrictEqual({
      commissionType: "PERCENTAGE",
      commissionValue: 5,
      email: null,
      fullName: "Asha Driver",
      mobileNumber: "+919876543210",
      paymentType: "COMMISSION",
      vehicleNumber: null
    });
    expect(
      buildDeliveryPartnerPayload(validForm({ warehouseIds: ["w3"] }), {
        canManagePay: true,
        isEditing: true,
        warehouseMode: "multiple"
      })
    ).toStrictEqual({
      email: null,
      fullName: "Asha Driver",
      mobileNumber: "+919876543210",
      vehicleNumber: null,
      warehouseIds: ["w3"]
    });
  });
});

describe("delivery partner ledger", () => {
  const now = new Date(2026, 9, 7, 12);

  it("formats the current salary month", () => {
    expect(getCurrentSalaryPeriod(now)).toBe("2026-10");
    expect(getCurrentSalaryPeriod(new Date(2026, 0, 31))).toBe("2026-01");
    expect(formatSalaryPeriod("2026-10")).toBe("October 2026");
    expect(formatSalaryPeriod("bad")).toBe("bad");
  });

  it("offers salary credits only to salary-based partners", () => {
    expect(getDeliveryLedgerEntryTypes(salaryPay)).toEqual(["PAYOUT", "SALARY", "DELIVERY_EARNING"]);
    expect(getDeliveryLedgerEntryTypes(noPay)).toEqual(["PAYOUT", "DELIVERY_EARNING"]);
  });

  it("prefills salary credits with the monthly salary and current month", () => {
    expect(createDeliveryLedgerForm("SALARY", salaryPay, now)).toEqual({
      amount: "18000",
      description: "Salary for October 2026",
      reference: "",
      salaryPeriod: "2026-10",
      type: "SALARY"
    });
    expect(createDeliveryLedgerForm("PAYOUT", salaryPay, now)).toEqual({
      amount: "",
      description: "Wallet payout",
      reference: "",
      salaryPeriod: "",
      type: "PAYOUT"
    });
  });

  it("validates amounts, payout balance, salary rules, and text lengths", () => {
    const payout = { ...createDeliveryLedgerForm("PAYOUT", noPay, now), amount: "500" };

    expect(validateDeliveryLedgerForm(payout, { balance: 500, payment: noPay })).toEqual({});
    expect(validateDeliveryLedgerForm(payout, { balance: 499.99, payment: noPay })).toEqual({
      amount: "A payout cannot exceed the wallet balance of ₹499.99."
    });
    expect(
      validateDeliveryLedgerForm(
        { ...payout, amount: "-1", description: " ", reference: "r".repeat(121) },
        { balance: 1000, payment: noPay }
      )
    ).toEqual({
      amount: "Enter an amount greater than 0 with up to 2 decimal places.",
      description: "Enter a description for this entry.",
      reference: "Use 120 characters or fewer for the reference."
    });
    expect(
      validateDeliveryLedgerForm(
        { ...createDeliveryLedgerForm("SALARY", salaryPay, now), salaryPeriod: "" },
        { balance: 0, payment: noPay }
      )
    ).toEqual({
      salaryPeriod: "Choose the salary month to credit.",
      type: "Salary can be credited only to salary-based partners."
    });
  });

  it("builds ledger bodies with salary month and reference only when needed", () => {
    expect(
      buildDeliveryLedgerPayload({
        ...createDeliveryLedgerForm("SALARY", salaryPay, now),
        reference: " SAL-OCT "
      })
    ).toStrictEqual({
      amount: 18000,
      description: "Salary for October 2026",
      reference: "SAL-OCT",
      salaryPeriod: "2026-10",
      type: "SALARY"
    });
    expect(
      buildDeliveryLedgerPayload({ ...createDeliveryLedgerForm("PAYOUT", noPay, now), amount: "250.5", salaryPeriod: "2026-10" })
    ).toStrictEqual({ amount: 250.5, description: "Wallet payout", type: "PAYOUT" });
  });

  it("labels and signs ledger entries", () => {
    expect(formatDeliveryLedgerEntryType({ deliveryAssignmentId: "a1", type: "DELIVERY_EARNING" })).toBe(
      "Delivery commission"
    );
    expect(formatDeliveryLedgerEntryType({ deliveryAssignmentId: null, type: "DELIVERY_EARNING" })).toBe(
      "Delivery earning"
    );
    expect(formatDeliveryLedgerEntryType({ deliveryAssignmentId: null, type: "SALARY" })).toBe("Salary credit");
    expect(formatDeliveryLedgerAmount({ amount: 5000, type: "PAYOUT" })).toBe("-₹5,000.00");
    expect(formatDeliveryLedgerAmount({ amount: 61.25, type: "DELIVERY_EARNING" })).toBe("+₹61.25");
  });
});
