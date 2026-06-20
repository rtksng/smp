import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketplaceBanner, MarketplaceProofStrip } from "./marketplace-banner";

describe("MarketplaceBanner", () => {
  it("renders dynamic banner copy, route-safe CTAs, and optional imagery", () => {
    render(
      <MarketplaceBanner
        ctaHref="/products?q=gloves"
        ctaText="Shop gloves"
        imageAlt="Sterile gloves"
        imageUrl="https://example.com/gloves.png"
        secondaryCtaHref="/categories/consumables"
        secondaryCtaText="Explore consumables"
        subtitle="Stock sterile gloves, masks, and OT disposables with GST-ready invoices."
        title="Consumables for high-volume clinical purchase"
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Consumables for high-volume clinical purchase"
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop gloves" })).toHaveAttribute(
      "href",
      "/products?q=gloves"
    );
    expect(screen.getByRole("link", { name: "Explore consumables" })).toHaveAttribute(
      "href",
      "/categories/consumables"
    );
    expect(screen.getByAltText("Sterile gloves")).toBeInTheDocument();
  });

  it("renders the reference-style customer hero with desktop-only banner art", () => {
    render(
      <MarketplaceBanner
        ctaHref="/products"
        ctaText="Browse catalog"
        imageAlt="Clinical supplies arranged for hospital procurement"
        imageUrl="/banner/banner.png"
        secondaryCtaHref="#bulk"
        secondaryCtaText="Bulk quote"
        subtitle="Your one-stop shop for verified surgical equipment, consumables, and diagnostics with GST-ready checkout."
        title="Hospital supplies, ordered simply."
        tone="navy"
      />
    );

    const desktopBackground = screen.getByTestId("hero-background-image");

    expect(
      screen.queryByText("Trusted. Verified. Ready when you need it.")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("customer-hero")).not.toHaveTextContent("10,000+");
    expect(screen.queryByTestId("hero-proof-section")).not.toBeInTheDocument();

    const heading = screen.getByRole("heading", {
      name: "Hospital supplies, ordered simply."
    });

    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("font-bold", "sm:text-5xl");
    expect(heading).not.toHaveClass("font-black", "xl:text-[4.8rem]");
    expect(screen.getByRole("link", { name: /Browse catalog/i })).toHaveAttribute(
      "href",
      "/products"
    );
    expect(screen.getByRole("link", { name: /Bulk quote/i })).toHaveAttribute(
      "href",
      "#bulk"
    );
    expect(desktopBackground).toHaveClass("hidden", "md:block");
    expect(desktopBackground.getAttribute("style")).toContain("/banner/banner.png");
    expect(screen.getByText("Verified Products")).toBeInTheDocument();
    expect(screen.getByText("GST Ready")).toBeInTheDocument();
    expect(screen.getByText("Fast & Reliable Delivery")).toBeInTheDocument();
    expect(screen.getByText("Dedicated Support")).toBeInTheDocument();
  });

  it("renders the metrics strip as a standalone section outside the hero", () => {
    render(<MarketplaceProofStrip />);

    expect(screen.getByTestId("hero-proof-section").tagName).toBe("SECTION");
    expect(screen.getByTestId("hero-proof-strip")).not.toHaveClass("md:-mt-16");
    expect(screen.getByText("10,000+")).toBeInTheDocument();
    expect(screen.getByText("5,000+")).toBeInTheDocument();
    expect(screen.getByText("99%")).toBeInTheDocument();
    expect(screen.getByText("GST Billing")).toBeInTheDocument();
  });
});
