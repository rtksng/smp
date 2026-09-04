import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminQuoteRequest } from "../../../lib/support-management";
import { QuoteRequestDetailPage } from "./quote-request-sections";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../../lib/admin-session", () => ({ useAdminSession: () => ({ api: { request } }), ProtectedRoute: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../admin-shell", () => ({ AdminShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "quote-1" }) }));
const emptyQuote: AdminQuoteRequest = { id: "quote-1", createdAt: "2026-09-04T10:00:00Z", status: "NEW", name: "QA customer", email: "qa@example.com", mobileNumber: "+919000000000", organization: null, message: "Two custom kits", quotation: null, customerDecision: null, convertedCartId: null, convertedOrderId: null };
function renderPage() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><QuoteRequestDetailPage /></QueryClientProvider>); }
beforeEach(() => request.mockReset());

describe("quotation detail workflow", () => {
  it("validates empty lines before sending and surfaces request errors", async () => {
    request.mockImplementation(async (_path: string, options?: { method?: string }) => { if (options?.method === "PATCH") throw new Error("Unable to save quotation"); return emptyQuote; });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Send quotation" }));
    expect(screen.getByRole("alert")).toHaveTextContent("enter a SKU");
    fireEvent.change(screen.getByLabelText("Line 1 SKU"), { target: { value: "CUSTOM-1" } });
    fireEvent.change(screen.getByLabelText("Line 1 item name"), { target: { value: "Custom kit" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "100.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Send quotation" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to save quotation"));
    expect(screen.getByLabelText("Line 1 SKU")).toHaveValue("CUSTOM-1");
  });

  it("keeps quotation inputs locked during submission", async () => {
    request.mockImplementation((_path: string, options?: { method?: string }) => options?.method === "PATCH" ? new Promise(() => {}) : Promise.resolve(emptyQuote));
    renderPage();
    await screen.findByRole("button", { name: "Send quotation" });
    fireEvent.change(screen.getByLabelText("Line 1 SKU"), { target: { value: "CUSTOM-1" } });
    fireEvent.change(screen.getByLabelText("Line 1 item name"), { target: { value: "Custom kit" } });
    fireEvent.click(screen.getByRole("button", { name: "Send quotation" }));
    await waitFor(() => expect(screen.getByLabelText("Line 1 SKU")).toBeDisabled());
    expect(screen.getByRole("button", { name: "Add line" })).toBeDisabled();
  });

  it("does not offer quotation editing on a converted request", async () => {
    request.mockResolvedValue({ ...emptyQuote, status: "CONVERTED", convertedOrderId: "order-1" });
    renderPage();
    expect(await screen.findByText("Closed or converted quotations cannot be edited.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send quotation" })).not.toBeInTheDocument();
  });
});
