import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("uses mobile-friendly tap target sizing for buttons and links", () => {
    render(
      <>
        <Button>Submit</Button>
        <Button href="/products">Products</Button>
      </>
    );

    expect(screen.getByRole("button", { name: "Submit" }).className).toContain(
      "min-h-12"
    );
    expect(screen.getByRole("link", { name: "Products" }).className).toContain(
      "min-h-12"
    );
  });
});
