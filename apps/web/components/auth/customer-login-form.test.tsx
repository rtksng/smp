import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { CustomerLoginForm } from "./customer-login-form";

describe("CustomerLoginForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCustomerAuthStore.setState(useCustomerAuthStore.getInitialState(), true);
    useCustomerAuthStore.setState({ isHydrated: true });
  });

  afterEach(() => {
    window.localStorage.clear();
    useCustomerAuthStore.setState(useCustomerAuthStore.getInitialState(), true);
  });

  it("shows the development OTP badge after requesting an OTP", async () => {
    const requestOtp = vi.fn().mockResolvedValue({
      devOtp: "654321",
      expiresInSeconds: 300,
      mobileNumber: "+919876543210",
      resendAfterSeconds: 0
    });

    useCustomerAuthStore.setState({
      requestOtp
    });

    renderLoginForm(<CustomerLoginForm />);

    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "98765 43210" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Request OTP/i }));

    const devOtpBadge = await screen.findByLabelText("Development OTP 654321");

    expect(requestOtp.mock.calls[0]?.[0]).toBe("98765 43210");
    expect(devOtpBadge).toHaveClass("rounded-full");
    expect(devOtpBadge).toHaveTextContent("Dev OTP");
    expect(devOtpBadge).toHaveTextContent("654321");
  });
});

function renderLoginForm(ui: ReactElement) {
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
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}
