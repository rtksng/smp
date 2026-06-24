import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "./footer";

describe("Footer", () => {
  it("uses an expanded responsive footer layout on mobile and desktop", () => {
    render(<Footer />);

    expect(screen.getByRole("contentinfo")).toHaveClass(
      "min-h-[24rem]",
      "pb-32",
      "pt-12",
      "md:min-h-[20rem]",
      "md:py-16"
    );
    expect(screen.getByTestId("footer-content")).toHaveClass(
      "lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.6fr)]"
    );
    expect(screen.getByRole("link", { name: "+91 90000 00000" })).toHaveClass(
      "w-full",
      "sm:w-auto"
    );
    expect(screen.getByRole("heading", { name: "Shop" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All products" })).toHaveAttribute(
      "href",
      "/products"
    );
    expect(screen.getByRole("heading", { name: "Support" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/account/orders"
    );
    expect(screen.getByRole("heading", { name: "Procurement" }))
      .toBeInTheDocument();
    expect(screen.getByText("GST-ready invoices")).toBeInTheDocument();
  });
});
