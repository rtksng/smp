import { afterEach, describe, expect, it, vi } from "vitest";
import { createProductReview } from "./product-feedback";
import { requestCustomerApi } from "./customer-client";

vi.mock("./client", () => ({ requestApi: vi.fn() }));
vi.mock("./customer-client", () => ({ requestCustomerApi: vi.fn(async () => ({})) }));

afterEach(() => vi.clearAllMocks());

describe("customer product review contract", () => {
  it("preserves the optional review title supported by the customer web form", async () => {
    await createProductReview("sterile/kit", {
      comment: "  Works well in our clinic.  ",
      rating: 5,
      title: "  Good quality  "
    });

    expect(requestCustomerApi).toHaveBeenCalledWith(
      "/products/sterile%2Fkit/feedback/reviews", expect.anything(),
      { method: "POST", body: { comment: "Works well in our clinic.", rating: 5, title: "Good quality" } }
    );
  });
});
