import { describe, expect, it } from "vitest";
import { normalizeIndianMobileNumber, normalizeOtpInput } from "./mobile";

describe("normalizeIndianMobileNumber", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["91-98765-43210", "+919876543210"],
    ["+919876543210", "+919876543210"]
  ])("normalizes %s to the API E.164 contract", (input, expected) => {
    expect(normalizeIndianMobileNumber(input)).toBe(expected);
  });

  it("rejects an invalid Indian mobile number before an API request", () => {
    expect(() => normalizeIndianMobileNumber("12345")).toThrow(
      "Enter a valid 10 digit Indian mobile number."
    );
  });
});

describe("normalizeOtpInput", () => {
  it.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    ["123-456", "123456"],
    ["Code: 123456", "123456"]
  ])("keeps a full six-digit code when pasting %s", (input, expected) => {
    expect(normalizeOtpInput(input)).toBe(expected);
  });

  it("caps longer pasted values at six digits", () => {
    expect(normalizeOtpInput("123456789")).toBe("123456");
  });
});
