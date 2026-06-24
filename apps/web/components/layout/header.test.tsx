import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./header";

const mocks = vi.hoisted(() => ({
  getCart: vi.fn(),
  getCategories: vi.fn()
}));

vi.mock("../../lib/api/cart", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api/cart")>()),
  getCart: mocks.getCart
}));

vi.mock("../../lib/api/categories", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api/categories")>()),
  getCategories: mocks.getCategories
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe("Header", () => {
  beforeEach(() => {
    mocks.getCart.mockReset();
    mocks.getCategories.mockReset();
    mocks.getCategories.mockResolvedValue([]);
  });

  it("stays fixed at the top of the viewport on every screen", () => {
    renderHeader(<Header />);

    expect(screen.getByRole("banner")).toHaveClass(
      "fixed",
      "inset-x-0",
      "top-0"
    );
    expect(screen.getByTestId("header-fixed-spacer")).toHaveClass("h-[6.5rem]");
  });
});

function renderHeader(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}
