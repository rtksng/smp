import { afterEach, describe, expect, it, vi } from "vitest";
import { quoteFixture } from "../testing/commerce-fixtures";
import { createQuoteRequest, listCustomerQuoteRequests, quoteRequestInputSchema } from "./quotes";
import { listAvailableCoupons, validateCoupon } from "./coupons";

vi.mock("./client", () => ({ requestApi: vi.fn(async (_path, _schema, options) => options.body) }));
vi.mock("./customer-client", () => ({ requestCustomerApi: vi.fn(async () => ({})) }));
import { requestApi } from "./client";
import { requestCustomerApi } from "./customer-client";
afterEach(() => vi.clearAllMocks());

describe("mobile quote and promo API contracts", () => {
  it.each(["9000000000", "+91 90000 00000", "09000000000"])("normalizes quote contact %s", async (mobileNumber) => {
    const quote = quoteFixture();
    await createQuoteRequest({ name: quote.name, email: quote.email, mobileNumber, message: quote.message });
    expect(requestApi).toHaveBeenCalledWith("/quote-requests", expect.anything(), expect.objectContaining({ body: expect.objectContaining({ mobileNumber: "+919000000000" }), method: "POST" }));
  });
  it.each(["12345678", "abc9000000000", "+12025550123"])("rejects invalid quote contact %s", (mobileNumber) => {
    expect(quoteRequestInputSchema.safeParse({ ...quoteFixture(), mobileNumber }).success).toBe(false);
  });
  it("sends quote pagination and loads/apply coupons through the shared customer endpoints", async () => {
    await listCustomerQuoteRequests(2, 20);
    expect(requestCustomerApi).toHaveBeenCalledWith("/quote-requests/my", expect.anything(), { query: { page: 2, limit: 20 } });
    await listAvailableCoupons();
    expect(requestCustomerApi).toHaveBeenCalledWith("/coupons/available", expect.anything());
    await validateCoupon(" save50 ");
    expect(requestCustomerApi).toHaveBeenCalledWith("/coupons/validate", expect.anything(), { body: { code: "SAVE50" }, method: "POST" });
  });
});
