import { expect, test } from "vitest";
import { formatCurrency } from "./status";

test("delivery cash amounts retain paise without adding unnecessary zeroes", () => {
  expect(formatCurrency(1225.5)).toBe("₹1,225.5");
  expect(formatCurrency(1225.05)).toBe("₹1,225.05");
  expect(formatCurrency(1225)).toBe("₹1,225");
});
