// @vitest-environment jsdom
import { useEffect, type PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QuotesScreen from "../app/account/quotes";
import CheckoutScreen from "../app/checkout";
import HomeScreen from "../app/(tabs)/index";
import { AvailableCoupons } from "./checkout/available-coupons";
import { addressFixture, availableCouponFixture, cartFixture, couponValidationFixture, quoteFixture } from "../lib/testing/commerce-fixtures";
import { queryKeys } from "../lib/query";

const mocks = vi.hoisted(() => ({
  accept: vi.fn(), reject: vi.fn(), cart: vi.fn(), order: vi.fn(), createQuote: vi.fn(), listQuotes: vi.fn(), getCart: vi.fn(),
  listAddresses: vi.fn(), available: vi.fn(), validate: vi.fn(), createOrder: vi.fn(), gateway: vi.fn(), createPayment: vi.fn(), openPayment: vi.fn(),
  push: vi.fn(), replace: vi.fn(),
  session: { customer: { id: "customer-1", firstName: "QA", email: "qa@example.com", mobileNumber: "+919000000000" } }
}));
vi.mock("expo-router", () => ({ router: { push: mocks.push, replace: mocks.replace }, Link: ({ children }: PropsWithChildren) => <div>{children}</div>, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }));
vi.mock("expo-haptics", () => ({ selectionAsync: vi.fn() }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("expo-image", () => ({ Image: () => null }));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null, Feather: () => null }));
vi.mock("@/components/ui/screen", () => ({ Screen: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ isReady: true, session: mocks.session }) }));
vi.mock("@/lib/api/customer-client", () => ({ requestCustomerApi: vi.fn() }));
vi.mock("@/lib/api/quotes", async () => ({ ...await vi.importActual("@/lib/api/quotes"), createQuoteRequest: mocks.createQuote, acceptQuoteRequest: mocks.accept, rejectQuoteRequest: mocks.reject, convertQuoteToCart: mocks.cart, convertQuoteToOrder: mocks.order, listCustomerQuoteRequests: mocks.listQuotes }));
vi.mock("@/lib/api/catalog", () => ({ getCategories: vi.fn(async () => []), getBrands: vi.fn(async () => []), getProducts: vi.fn(async () => ({ items: [] })) }));
vi.mock("@/components/product-card", () => ({ ProductCard: () => null }));
vi.mock("react-native-keyboard-controller", () => ({ KeyboardAwareScrollView: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/lib/api/cart", () => ({ getCart: mocks.getCart }));
vi.mock("@/lib/api/customer", () => ({ listAddresses: mocks.listAddresses, createAddress: vi.fn(), updateAddress: vi.fn() }));
vi.mock("@/lib/api/coupons", () => ({ listAvailableCoupons: mocks.available, validateCoupon: mocks.validate }));
vi.mock("@/lib/api/orders", () => ({ createOrder: mocks.createOrder }));
vi.mock("@/lib/api/payments", () => ({ getPaymentGatewayStatus: mocks.gateway, createRazorpayOrder: mocks.createPayment, verifyRazorpayPayment: vi.fn() }));
vi.mock("@/lib/payments/razorpay", () => ({ normalizeRazorpayContact: vi.fn(), openRazorpayCheckout: mocks.openPayment }));

const clients: QueryClient[] = [];
const page = (items = [quoteFixture()], current = 1, total = 1) => ({ items, pagination: { page: current, limit: 20, total, totalPages: Math.ceil(total / 20), hasNextPage: current * 20 < total, hasPreviousPage: current > 1 } });
function renderFlow(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  return client;
}
function expectDisabled(element: HTMLElement) { expect(element.getAttribute("aria-disabled")).toBe("true"); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listQuotes.mockResolvedValue(page());
  mocks.createQuote.mockResolvedValue(quoteFixture({ status: "NEW" }));
  mocks.accept.mockResolvedValue(quoteFixture({ status: "ACCEPTED" }));
  mocks.reject.mockResolvedValue(quoteFixture({ status: "REJECTED" }));
  mocks.cart.mockResolvedValue({ cart: cartFixture(), quote: quoteFixture({ status: "CONVERTED" }) });
  mocks.order.mockResolvedValue({ order: { id: "order-1" }, quote: quoteFixture({ status: "CONVERTED", convertedOrderId: "order-1" }) });
  mocks.getCart.mockResolvedValue(cartFixture());
  mocks.listAddresses.mockResolvedValue([addressFixture]);
  mocks.available.mockResolvedValue({ items: [availableCouponFixture, { ...availableCouponFixture, code: "MIN1000", minOrderAmount: 1000 }, { ...availableCouponFixture, code: "SAVE10", type: "PERCENTAGE", value: 10 }] });
  mocks.validate.mockResolvedValue(couponValidationFixture);
  mocks.gateway.mockResolvedValue({ onlinePaymentEnabled: false });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe("mobile quote screen", () => {
  it("validates the bulk request, locks its fields during submission, and refreshes quote history", async () => {
    let resolveQuote!: (value: ReturnType<typeof quoteFixture>) => void;
    mocks.createQuote.mockReturnValue(new Promise(resolve => { resolveQuote = resolve; }));
    const client = renderFlow(<HomeScreen />);
    const historyKey = [...queryKeys.quotes, "customer-1", 1];
    client.setQueryData(historyKey, page());
    fireEvent.click(await screen.findByRole("button", { name: "Request bulk quote" }));
    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(mocks.createQuote).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "QA Customer" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "qa@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Mobile number"), { target: { value: "9000000000" } });
    fireEvent.change(screen.getByPlaceholderText("SKUs, quantities, city, and delivery timeline"), { target: { value: "Need two sterile kits for a clinic." } });
    fireEvent.click(screen.getByRole("button", { name: "Request bulk quote" }));
    await waitFor(() => expect((screen.getByPlaceholderText("Name") as HTMLInputElement).readOnly).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Request bulk quote" }));
    expect(mocks.createQuote).toHaveBeenCalledTimes(1);
    expect(mocks.createQuote).toHaveBeenCalledWith(expect.objectContaining({ mobileNumber: "+919000000000" }), expect.anything());
    await act(async () => resolveQuote(quoteFixture({ status: "NEW" })));
    expect(await screen.findByText("Quote request quote-mobile-1 received.")).toBeTruthy();
    expect((screen.getByPlaceholderText("Name") as HTMLInputElement).value).toBe("");
    expect(client.getQueryState(historyKey)?.isInvalidated).toBe(true);
  });

  it("locks opposing/duplicate decisions, then clears a failed action when another action succeeds", async () => {
    let rejectRequest!: (error: Error) => void;
    mocks.accept.mockReturnValue(new Promise((_resolve, reject) => { rejectRequest = reject; }));
    renderFlow(<QuotesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept quote" }));
    await waitFor(() => expectDisabled(screen.getByRole("button", { name: "Reject" })));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(mocks.reject).not.toHaveBeenCalled();
    expect(mocks.accept).toHaveBeenCalledTimes(1);
    await act(async () => rejectRequest(new Error("Quotation temporarily unavailable")));
    expect(await screen.findByText("Quotation temporarily unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith("quote-mobile-1", expect.anything()));
    await waitFor(() => expect(screen.queryByText("Quotation temporarily unavailable")).toBeNull());
  });

  it("blocks accepting expired prices but still permits rejecting them", async () => {
    const expired = quoteFixture();
    expired.quotation!.validUntil = "2000-01-01";
    mocks.listQuotes.mockResolvedValue(page([expired]));
    renderFlow(<QuotesScreen />);
    expect(await screen.findByText(/This quotation has expired/)).toBeTruthy();
    expectDisabled(screen.getByRole("button", { name: "Accept quote" }));
    expect(screen.getByRole("button", { name: "Reject" }).getAttribute("aria-disabled")).not.toBe("true");
  });

  it("loads later quote pages and refreshes accepted catalog cart pricing before navigation", async () => {
    mocks.listQuotes.mockImplementation(async (current: number) => page([quoteFixture({ status: "ACCEPTED", id: `quote-${current}` })], current, 21));
    const client = renderFlow(<QuotesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 2")).toBeTruthy();
    expect(mocks.listQuotes).toHaveBeenCalledWith(2, 20);
    fireEvent.click(screen.getByRole("button", { name: "Prepare cart" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/cart"));
    expect(client.getQueryData(queryKeys.cart())).toEqual(cartFixture());
  });

  it("shows existing catalog orders instead of offering another cart conversion", async () => {
    mocks.listQuotes.mockResolvedValue(page([quoteFixture({ status: "CONVERTED", convertedOrderId: "existing-order" })]));
    renderFlow(<QuotesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "View order" }));
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/orders/[id]", params: { id: "existing-order" } });
    expect(screen.queryByRole("button", { name: "Prepare cart" })).toBeNull();
  });

  it("creates custom quote orders once and navigates to the resulting order", async () => {
    const custom = quoteFixture({ status: "ACCEPTED" });
    custom.quotation!.items[0]!.productId = null;
    mocks.listQuotes.mockResolvedValue(page([custom]));
    renderFlow(<QuotesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Create order" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith({ pathname: "/orders/[id]", params: { id: "order-1" } }));
    expect(mocks.order).toHaveBeenCalledTimes(1);
  });
});

describe("mobile promo checkout", () => {
  it("retains the pending online order when refreshed cart prices change during payment", async () => {
    mocks.gateway.mockResolvedValue({ onlinePaymentEnabled: true });
    mocks.createOrder.mockResolvedValue({ id: "order-pending", orderNumber: "QA-ORDER" });
    let rejectPayment!: (error: Error) => void;
    mocks.createPayment.mockReturnValue(new Promise((_resolve, reject) => { rejectPayment = reject; }));
    const client = renderFlow(<CheckoutScreen />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Place COD order" }).getAttribute("aria-disabled")).not.toBe("true"));
    fireEvent.click(screen.getByRole("radio", { name: /Pay online/ }));
    fireEvent.click(screen.getByRole("button", { name: "Place order and pay" }));
    await waitFor(() => expect(mocks.createPayment).toHaveBeenCalledWith("order-pending"));
    const refreshed = cartFixture();
    refreshed.items[0]!.unitPrice = 700;
    await act(async () => { client.setQueriesData({ queryKey: ["customer", "cart"] }, refreshed); });
    await act(async () => rejectPayment(new Error("Payment cancelled")));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/payment-failed?orderId=order-pending&reason=Payment%20cancelled"));
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
  });

  it("applies an available coupon, preserves quote shipping, and restores the amount on removal", async () => {
    renderFlow(<CheckoutScreen />);
    const apply = await screen.findByRole("button", { name: "Apply SAVE50" });
    await waitFor(() => expect(apply.getAttribute("aria-disabled")).not.toBe("true"));
    expectDisabled(screen.getByRole("button", { name: "Apply MIN1000" }));
    fireEvent.click(apply);
    expect(await screen.findByText("SAVE50 applied successfully.")).toBeTruthy();
    expect(mocks.validate).toHaveBeenCalledWith("SAVE50");
    expect(screen.getAllByText("₹565.50").length).toBeGreaterThan(0);
    expect(screen.getByText("₹25.50")).toBeTruthy();
    expectDisabled(screen.getByRole("button", { name: "SAVE50 applied" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("SAVE50 applied successfully.")).toBeNull());
    expect(screen.getAllByText("₹615.50").length).toBeGreaterThan(0);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("blocks checkout while validation is pending and blocks stale discounts after cart edits", async () => {
    let resolveCoupon!: (value: typeof couponValidationFixture) => void;
    mocks.validate.mockReturnValue(new Promise(resolve => { resolveCoupon = resolve; }));
    const client = renderFlow(<CheckoutScreen />);
    const apply = await screen.findByRole("button", { name: "Apply SAVE50" });
    await waitFor(() => expect(apply.getAttribute("aria-disabled")).not.toBe("true"));
    fireEvent.click(apply);
    await waitFor(() => expectDisabled(screen.getByRole("button", { name: "Place COD order" })));
    fireEvent.click(screen.getByRole("button", { name: "Place COD order" }));
    expect(mocks.createOrder).not.toHaveBeenCalled();
    await act(async () => resolveCoupon(couponValidationFixture));
    expect(await screen.findByText("SAVE50 applied successfully.")).toBeTruthy();
    const updatedCart = cartFixture();
    updatedCart.items[0]!.quantity = 2;
    await act(async () => { client.setQueriesData({ queryKey: ["customer", "cart"] }, updatedCart); });
    expect(await screen.findByText(/Your cart changed/)).toBeTruthy();
    expectDisabled(screen.getByRole("button", { name: "Place COD order" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText(/Your cart changed/)).toBeNull());
  });

  it("keeps manual entry usable when promo discovery fails and retries discovery", async () => {
    mocks.available.mockRejectedValueOnce(new Error("Offline"));
    renderFlow(<AvailableCoupons appliedCode={null} disabled={false} onApply={vi.fn()} subtotal={500} />);
    expect(await screen.findByText(/You can still enter a code above/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry promo codes" }));
    expect(await screen.findByRole("button", { name: "Apply SAVE50" })).toBeTruthy();
  });

  it("shows failed manual validation without applying a discount and allows another code", async () => {
    mocks.validate.mockRejectedValueOnce(new Error("Coupon is expired"));
    renderFlow(<CheckoutScreen />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Place COD order" }).getAttribute("aria-disabled")).not.toBe("true"));
    const input = await screen.findByRole("textbox", { name: "Promo code" });
    await waitFor(() => expect((input as HTMLInputElement).readOnly).toBe(false));
    fireEvent.change(input, { target: { value: " expired " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Coupon is expired")).toBeTruthy();
    expect(screen.getAllByText("₹615.50").length).toBeGreaterThan(0);
    fireEvent.change(input, { target: { value: "save50" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("SAVE50 applied successfully.")).toBeTruthy();
    expect(screen.queryByText("Coupon is expired")).toBeNull();
  });
});
