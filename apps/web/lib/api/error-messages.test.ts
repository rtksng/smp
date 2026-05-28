import { describe, expect, it } from "vitest";
import { ApiClientError } from "./client";
import {
  getFriendlyApiErrorMessage,
  isNotFoundApiError,
  stockErrorMessage
} from "./error-messages";

describe("friendly API error messages", () => {
  it("normalizes typed API errors to customer-safe messages", () => {
    expect(
      getFriendlyApiErrorMessage(
        new ApiClientError("Internal server error", 500, "INTERNAL_ERROR"),
        "Unable to load products."
      )
    ).toBe("Something went wrong while loading this information. Please try again.");
  });

  it("preserves useful validation and not-found messages", () => {
    expect(
      getFriendlyApiErrorMessage(
        new ApiClientError("Product was not found.", 404, "NOT_FOUND"),
        "Unable to load product."
      )
    ).toBe("Product was not found.");
    expect(
      getFriendlyApiErrorMessage(
        new ApiClientError("Select a delivery address.", 400, "VALIDATION_ERROR"),
        "Unable to place order."
      )
    ).toBe("Select a delivery address.");
  });

  it("detects not-found API failures", () => {
    expect(isNotFoundApiError(new ApiClientError("Missing", 404, "NOT_FOUND"))).toBe(
      true
    );
    expect(isNotFoundApiError(new Error("Missing"))).toBe(false);
  });

  it("uses a consistent product out-of-stock message", () => {
    expect(stockErrorMessage(3)).toBe(
      "Product out of stock. Only 3 unit(s) are available right now."
    );
  });
});
