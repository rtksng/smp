import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchForm } from "./search-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe("SearchForm", () => {
  it("renders procurement shortcut links when suggestions are provided", () => {
    render(
      <SearchForm
        id="search"
        suggestions={["Sutures", "Pulse oximeter", "Sterile gloves"]}
      />
    );

    expect(screen.getByRole("link", { name: "Sutures" })).toHaveAttribute(
      "href",
      "/products?q=Sutures"
    );
    expect(screen.getByRole("link", { name: "Pulse oximeter" })).toHaveAttribute(
      "href",
      "/products?q=Pulse+oximeter"
    );
  });
});
