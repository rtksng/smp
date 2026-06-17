import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BulkQuoteForm } from "./bulk-quote-form";

const mocks = vi.hoisted(() => ({
  createQuoteRequest: vi.fn()
}));

vi.mock("../../lib/api/quote-requests", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/quote-requests")>(
    "../../lib/api/quote-requests"
  );

  return {
    ...actual,
    createQuoteRequest: mocks.createQuoteRequest
  };
});

describe("BulkQuoteForm", () => {
  beforeEach(() => {
    mocks.createQuoteRequest.mockReset();
    mocks.createQuoteRequest.mockResolvedValue({
      createdAt: "2026-06-15T10:00:00.000Z",
      email: "asha@example.com",
      id: "quote-1",
      message: "Need 20 forceps for Mumbai",
      mobileNumber: "+919876543210",
      name: "Dr Asha Rao",
      organization: "Asha Surgical Clinic",
      status: "NEW"
    });
  });

  it("validates and submits a bulk quote request", async () => {
    renderBulkQuoteForm();

    fireEvent.click(screen.getByRole("button", { name: "Request bulk quote" }));

    expect(
      await screen.findByText("Describe SKUs, quantities, and delivery needs.")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Dr Asha Rao" }
    });
    fireEvent.change(screen.getByLabelText("Organization"), {
      target: { value: "Asha Surgical Clinic" }
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "asha@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "+919876543210" }
    });
    fireEvent.change(screen.getByLabelText("Bulk quote details"), {
      target: { value: "Need 20 forceps for Mumbai" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Request bulk quote" }));

    await waitFor(() => {
      expect(mocks.createQuoteRequest.mock.calls[0]?.[0]).toEqual({
        email: "asha@example.com",
        message: "Need 20 forceps for Mumbai",
        mobileNumber: "+919876543210",
        name: "Dr Asha Rao",
        organization: "Asha Surgical Clinic"
      });
    });
    expect(await screen.findByText("Quote request quote-1 received.")).toBeInTheDocument();
  });
});

function renderBulkQuoteForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false
      },
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BulkQuoteForm />
    </QueryClientProvider>
  );
}
