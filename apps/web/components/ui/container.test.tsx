import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Container } from "./container";

describe("Container", () => {
  it("uses the wider storefront content width", () => {
    render(<Container>Catalog content</Container>);

    expect(screen.getByText("Catalog content").className).toContain(
      "max-w-[92rem]"
    );
  });
});
