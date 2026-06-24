import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, Fragment } from "react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./empty-state";
import { ErrorState, RetryButton } from "./error-state";
import { PageLoader, SectionLoader } from "./loading-spinner";
import { ProductGridSkeleton, TableSkeleton } from "./skeleton";

describe("shared feedback states", () => {
  it("renders page loading as a non-blocking top progress bar", () => {
    render(
      createElement(
        Fragment,
        null,
        createElement(PageLoader, { label: "Loading catalog" }),
        createElement(SectionLoader, { label: "Loading orders" })
      )
    );

    const pageLoader = screen.getByRole("status", { name: "Loading catalog" });

    expect(pageLoader).toHaveClass("fixed", "top-0", "pointer-events-none");
    expect(pageLoader).not.toHaveClass("min-h-[60vh]", "place-items-center");
    expect(screen.getByText("Loading orders")).toBeInTheDocument();
  });

  it("renders product grid and table skeletons with stable loading labels", () => {
    render(
      createElement(
        Fragment,
        null,
        createElement(ProductGridSkeleton, { count: 2 }),
        createElement(TableSkeleton, { columns: 3, rows: 2 })
      )
    );

    expect(screen.getByLabelText("Loading products")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading table rows")).toBeInTheDocument();
  });

  it("renders empty states with optional actions", () => {
    render(
      createElement(EmptyState, {
        action: createElement("a", { href: "/products" }, "Shop products"),
        description: "Add surgical and medical equipment before checkout.",
        title: "Your cart is empty"
      })
    );

    expect(screen.getByRole("heading", { name: "Your cart is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop products" })).toHaveAttribute(
      "href",
      "/products"
    );
  });

  it("renders retryable error states without hiding the message on mobile", async () => {
    const onRetry = vi.fn();

    render(
      createElement(ErrorState, {
        action: createElement(RetryButton, { onRetry }),
        message: "The catalog API is unavailable.",
        title: "Unable to load products"
      })
    );

    expect(
      screen.getByRole("heading", { name: "Unable to load products" })
    ).toBeInTheDocument();
    expect(screen.getByText("The catalog API is unavailable.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
