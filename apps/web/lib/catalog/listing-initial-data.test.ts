import { describe, expect, it } from "vitest";
import {
  getLockedProductFilters,
  searchParamsToUrlSearchParams
} from "./listing-initial-data";

describe("product listing initial data helpers", () => {
  it("normalizes Next searchParams records into URLSearchParams", () => {
    const params = searchParamsToUrlSearchParams({
      page: "2",
      q: "forceps",
      stock: ["in_stock", "out_of_stock"],
      unused: undefined
    });

    expect(params.get("q")).toBe("forceps");
    expect(params.get("page")).toBe("2");
    expect(params.getAll("stock")).toEqual(["in_stock", "out_of_stock"]);
    expect(params.has("unused")).toBe(false);
  });

  it("locks category and brand filters from the listing route context", () => {
    expect(getLockedProductFilters({ slug: "surgical", type: "category" })).toEqual({
      category: "surgical"
    });
    expect(
      getLockedProductFilters({
        slug: "dental",
        subcategorySlug: "endodontics",
        type: "subcategory"
      })
    ).toEqual({
      category: "dental",
      subcategory: "endodontics"
    });
    expect(getLockedProductFilters({ slug: "acme", type: "brand" })).toEqual({
      brand: "acme"
    });
    expect(getLockedProductFilters({ type: "all" })).toEqual({});
  });
});
