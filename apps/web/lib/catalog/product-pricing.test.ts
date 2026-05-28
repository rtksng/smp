import { describe, expect, it } from "vitest";
import { formatRupees, getProductSavings } from "./product-pricing";

describe("product pricing helpers", () => {
  it("formats rupee values without decimals for catalog purchase surfaces", () => {
    expect(formatRupees(9600)).toBe("₹9,600");
  });

  it("returns savings amount and rounded discount percentage when MRP is higher", () => {
    expect(getProductSavings({ mrp: 12000, sellingPrice: 9600 })).toEqual({
      amount: 2400,
      percent: 20
    });
  });

  it("does not report savings when MRP is not above selling price", () => {
    expect(getProductSavings({ mrp: 9600, sellingPrice: 9600 })).toBeNull();
  });
});
