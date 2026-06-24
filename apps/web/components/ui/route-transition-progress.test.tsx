import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteTransitionProgress } from "./route-transition-progress";

const navigationState = vi.hoisted(() => ({
  pathname: "/products",
  searchParams: new URLSearchParams()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams
}));

describe("RouteTransitionProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigationState.pathname = "/products";
    navigationState.searchParams = new URLSearchParams();
    window.history.replaceState(null, "", "/products");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows a non-blocking top bar for internal route links until the URL commits", () => {
    const routeAnchor = document.createElement("a");
    routeAnchor.href = "/categories/dental";
    const { rerender } = render(
      <>
        <RouteTransitionProgress />
        <span data-testid="route-link-target">Dental</span>
      </>
    );
    const routeLinkTarget = screen.getByTestId("route-link-target");
    vi.spyOn(routeLinkTarget, "closest").mockImplementation((selector) =>
      selector === "a[href]" ? routeAnchor : null
    );

    const status = screen.getByRole("status", {
      name: "Page transition loading"
    });

    expect(status).toHaveAttribute("data-state", "idle");
    expect(status).toHaveClass("fixed", "top-0", "pointer-events-none");

    fireEvent.click(routeLinkTarget);

    expect(status).toHaveAttribute("data-state", "loading");

    navigationState.pathname = "/categories/dental";
    rerender(
      <>
        <RouteTransitionProgress />
        <span data-testid="route-link-target">Dental</span>
      </>
    );

    expect(status).toHaveAttribute("data-state", "settling");

    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(status).toHaveAttribute("data-state", "idle");
  });

  it("starts for history-driven catalog filter and pagination transitions", () => {
    const { rerender } = render(<RouteTransitionProgress />);
    const status = screen.getByRole("status", {
      name: "Page transition loading"
    });

    act(() => {
      window.history.pushState(null, "", "/products?page=2");
    });

    expect(status).toHaveAttribute("data-state", "loading");

    navigationState.searchParams = new URLSearchParams("page=2");
    rerender(<RouteTransitionProgress />);

    expect(status).toHaveAttribute("data-state", "settling");

    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(status).toHaveAttribute("data-state", "idle");
  });
});
