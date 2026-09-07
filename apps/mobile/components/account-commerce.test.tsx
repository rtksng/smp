// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CartScreen from "../app/cart";
import LoginScreen from "../app/login";
import OrderDetailScreen from "../app/orders/[id]";
import { orderSchema } from "../lib/api/schemas";
import { cartFixture } from "../lib/testing/commerce-fixtures";

const mocks = vi.hoisted(() => ({
  getCart: vi.fn(), updateCartItem: vi.fn(), removeCartItem: vi.fn(),
  push: vi.fn(), replace: vi.fn(), requestOtp: vi.fn(), signInWithOtp: vi.fn(),
  getOrder: vi.fn(), shareInvoice: vi.fn(),
  authenticated: true
}));
vi.mock("expo-router", () => ({ router: { push: mocks.push, replace: mocks.replace }, useLocalSearchParams: () => ({ id: "order-1" }) }));
vi.mock("expo-haptics", () => ({ selectionAsync: vi.fn() }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("expo-image", () => ({ Image: () => null }));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null, Feather: () => null }));
vi.mock("@/components/ui/screen", () => ({ Screen: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/components/ui/keyboard-accessory", () => ({ KeyboardAccessory: () => null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ isReady: true, session: mocks.authenticated ? { customer: { id: "customer-1" } } : null, requestOtp: mocks.requestOtp, signInWithOtp: mocks.signInWithOtp }) }));
vi.mock("@/lib/api/cart", () => ({ getCart: mocks.getCart, updateCartItem: mocks.updateCartItem, removeCartItem: mocks.removeCartItem }));
vi.mock("@/lib/api/orders", () => ({ getOrder: mocks.getOrder, cancelOrder: vi.fn(), requestReturn: vi.fn(), reorder: vi.fn() }));
vi.mock("@/lib/api/customer-client", () => ({ requestCustomerApiResponse: vi.fn() }));
vi.mock("@/lib/api/invoices", async () => ({ ...await vi.importActual("@/lib/api/invoices"), shareOrderInvoice: mocks.shareInvoice }));
vi.mock("@/lib/api/payments", () => ({ createRazorpayOrder: vi.fn(), verifyRazorpayPayment: vi.fn() }));
vi.mock("@/lib/payments/razorpay", () => ({ normalizeRazorpayContact: vi.fn(), openRazorpayCheckout: vi.fn() }));

const clients: QueryClient[] = [];
function renderFlow(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
function expectDisabled(element: HTMLElement) { expect(element.getAttribute("aria-disabled")).toBe("true"); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated = true;
  mocks.getCart.mockResolvedValue(cartFixture());
  mocks.updateCartItem.mockResolvedValue(cartFixture());
  mocks.removeCartItem.mockResolvedValue({ ...cartFixture(), items: [], itemCount: 0, totalQuantity: 0 });
  mocks.requestOtp.mockResolvedValue({ mobileNumber: "+919000000000", resendAfterSeconds: 0 });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe("mobile cart parity", () => {
  it("identifies insufficient stock on the affected item and preserves its variant and product link", async () => {
    const cart = cartFixture();
    cart.items[0]!.quantity = 5;
    cart.items[0]!.availableQuantity = 2;
    cart.items[0]!.variantName = "Large sterile kit";
    mocks.getCart.mockResolvedValue(cart);
    renderFlow(<CartScreen />);
    expect(await screen.findByText("Only 2 currently available. Reduce the quantity to continue.")).toBeTruthy();
    expect(screen.getByText("Large sterile kit")).toBeTruthy();
    expectDisabled(screen.getByRole("button", { name: "Proceed to checkout" }));
    expectDisabled(screen.getByRole("button", { name: "Increase Sterile kit quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "View Sterile kit" }));
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/products/[slug]", params: { slug: "sterile-kit" } });
    fireEvent.click(screen.getByRole("button", { name: "Kits" }));
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/search", params: { category: "kits" } });
  });

  it("locks every cart action while a quantity update is pending", async () => {
    const cart = cartFixture();
    cart.items.push({ ...cart.items[0]!, id: "cart-item-2", name: "Gauze" });
    mocks.getCart.mockResolvedValue(cart);
    let resolveUpdate!: (cart: ReturnType<typeof cartFixture>) => void;
    mocks.updateCartItem.mockReturnValue(new Promise(resolve => { resolveUpdate = resolve; }));
    renderFlow(<CartScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Increase Sterile kit quantity" }));
    await waitFor(() => expectDisabled(screen.getByRole("button", { name: "Remove Gauze" })));
    expectDisabled(screen.getByRole("button", { name: "Increase Gauze quantity" }));
    expectDisabled(screen.getByRole("button", { name: "Proceed to checkout" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Gauze" }));
    expect(mocks.removeCartItem).not.toHaveBeenCalled();
    await act(async () => resolveUpdate(cart));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove Gauze" }).getAttribute("aria-disabled")).not.toBe("true"));
  });
});

describe("mobile OTP parity", () => {
  it("uses the returned normalized mobile number and clears the old OTP when resending", async () => {
    mocks.authenticated = false;
    renderFlow(<LoginScreen />);
    fireEvent.change(screen.getByPlaceholderText("98765 43210"), { target: { value: "90000 00000" } });
    fireEvent.click(screen.getByRole("button", { name: "Request OTP" }));
    expect(await screen.findByText("+919000000000")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("123456"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend OTP" }));
    await waitFor(() => expect((screen.getByPlaceholderText("123456") as HTMLInputElement).value).toBe(""));
    expect(mocks.requestOtp).toHaveBeenLastCalledWith("+919000000000");
    expectDisabled(screen.getByRole("button", { name: "Verify and continue" }));
  });
});

describe("mobile order detail parity", () => {
  it("shows delivery and refund updates and downloads an eligible order invoice with recovery after errors", async () => {
    const cart = cartFixture();
    const item = cart.items[0]!;
    const order = orderSchema.parse({
      id: "order-1", orderNumber: "SMP-1001", createdAt: "2026-09-04T10:00:00.000Z", updatedAt: "2026-09-04T10:00:00.000Z", placedAt: "2026-09-04T10:00:00.000Z",
      items: [{ ...item, taxAmount: item.tax, stockBatchId: null, warehouseId: null }],
      paymentMethod: "COD", paymentStatus: "PAID", status: "DELIVERED", statusHistory: [], totals: cart.totals, warehouseId: null, shippingAddress: null,
      refunds: [{ id: "refund-1", status: "PROCESSING", amount: 100, createdAt: "2026-09-04T10:00:00.000Z", processedAt: null, reason: "Damaged package", providerRefundId: "refund-reference" }],
      deliveryTracking: [{ id: "delivery-1", assignedAt: "2026-09-04T10:00:00.000Z", deliveredAt: "2026-09-04T10:00:00.000Z", pickedUpAt: null, status: "DELIVERED", deliveryPartnerName: "Delivery partner", vehicleNumber: null, failureReason: null, proofOfDeliveryUrl: "https://example.com/proof.png", statusHistory: [{ id: "tracking-1", createdAt: "2026-09-04T10:00:00.000Z", status: "DELIVERED", latitude: null, longitude: null, note: "Received at clinic reception" }] }]
    });
    mocks.getOrder.mockResolvedValue(order);
    mocks.shareInvoice.mockRejectedValueOnce(new Error("Invoice temporarily unavailable")).mockResolvedValueOnce(undefined);
    renderFlow(<OrderDetailScreen />);
    expect(await screen.findByText("Received at clinic reception")).toBeTruthy();
    expect(screen.getByText("Damaged package")).toBeTruthy();
    expect(screen.getByText("refund-reference")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View proof of delivery" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry online payment" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Download PDF invoice" }));
    expect(await screen.findByText("Invoice temporarily unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download PDF invoice" }));
    await waitFor(() => expect(mocks.shareInvoice).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Invoice temporarily unavailable")).toBeNull());
  });
});
