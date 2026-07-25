import { describe, expect, it } from "vitest";
import { normalizeRazorpayContact } from "./razorpay";

describe("normalizeRazorpayContact", () => {
  it("converts formatted Indian numbers to Razorpay's digit-only format", () => {
    expect(normalizeRazorpayContact("+91 98765-43210")).toBe("919876543210");
  });

  it("omits an empty contact value", () => {
    expect(normalizeRazorpayContact("")).toBeUndefined();
  });
});
