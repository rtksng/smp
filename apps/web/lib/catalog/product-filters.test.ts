import { describe, expect, it } from "vitest";
import {
  parseProductFilters,
  productFiltersToSearchParams,
  productFiltersToProductQuery
} from "./product-filters";

describe("product browsing filters", () => {
  it("parses URL params into sanitized listing filters", () => {
    const filters = parseProductFilters(
      new URLSearchParams({
        availability: "available",
        brand: "acme-surgical",
        category: "surgical-instruments",
        disposable: "true",
        expirySensitive: "true",
        maxPrice: "5000",
        medicalSpecialty: "general surgery",
        minPrice: "1000",
        page: "3",
        q: " forceps ",
        sort: "price_low_to_high",
        sterile: "true",
        stock: "in_stock"
      })
    );

    expect(filters).toEqual({
      availability: "available",
      brand: "acme-surgical",
      category: "surgical-instruments",
      disposable: true,
      expirySensitive: true,
      maxPrice: 5000,
      medicalSpecialty: "general surgery",
      minPrice: 1000,
      page: 3,
      search: "forceps",
      sort: "price_low_to_high",
      sterile: true,
      stock: "in_stock"
    });
  });

  it("maps listing filters to backend product query params", () => {
    const query = productFiltersToProductQuery({
      availability: "available",
      disposable: false,
      expirySensitive: true,
      maxPrice: 8000,
      minPrice: 500,
      page: 2,
      search: "scalpel",
      sort: "name_az",
      sterile: true,
      stock: "out_of_stock"
    });

    expect(query).toEqual({
      expirySensitive: true,
      inStock: true,
      limit: 12,
      maxPrice: 8000,
      minPrice: 500,
      page: 2,
      search: "scalpel",
      sort: "name_az",
      sterile: true
    });
  });

  it("serializes filters back to stable URL query params", () => {
    const params = productFiltersToSearchParams({
      brand: "acme-surgical",
      category: "surgical-instruments",
      maxPrice: 5000,
      medicalSpecialty: "General Surgery",
      minPrice: 1000,
      page: 1,
      search: "forceps",
      sort: "latest",
      stock: "in_stock"
    });

    expect(params.toString()).toBe(
      "q=forceps&category=surgical-instruments&brand=acme-surgical&minPrice=1000&maxPrice=5000&stock=in_stock&medicalSpecialty=General+Surgery"
    );
  });
});
