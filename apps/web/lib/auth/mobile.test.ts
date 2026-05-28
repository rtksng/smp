import { describe, expect, it } from "vitest";
import {
  isValidIndianMobileNumber,
  normalizeIndianMobileNumber
} from "./mobile";

describe("Indian mobile auth validation", () => {
  it("normalizes valid Indian mobile inputs to E.164", () => {
    expect(normalizeIndianMobileNumber("9876543210")).toBe("+919876543210");
    expect(normalizeIndianMobileNumber("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeIndianMobileNumber("91-98765-43210")).toBe("+919876543210");
  });

  it("rejects invalid Indian mobile numbers", () => {
    expect(isValidIndianMobileNumber("1234567890")).toBe(false);
    expect(isValidIndianMobileNumber("987654321")).toBe(false);
    expect(isValidIndianMobileNumber("+14155552671")).toBe(false);
  });
});
