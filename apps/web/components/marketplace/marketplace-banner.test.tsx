import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketplaceBanner } from "./marketplace-banner";

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
});
