import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginationControls } from "./pagination-controls";

describe("PaginationControls", () => {
  it("changes page size immediately and remains visible for one-page results", () => {
    const onPageSizeChange = vi.fn();

    render(
      <PaginationControls
        itemLabel="Products per page"
        onChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        page={1}
        pageSize={10}
        pageSizeOptions={[10, 50, 100, 500]}
        totalPages={1}
      />
    );

    const selector = screen.getByRole("combobox", { name: "Products per page" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "10",
      "50",
      "100",
      "500"
    ]);

    fireEvent.change(selector, { target: { value: "500" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(500);
  });

  it("keeps navigation available while announcing a background update", () => {
    render(<PaginationControls isPending onChange={vi.fn()} page={2} totalPages={4} />);

    expect(screen.getByText("Updating…")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });
});
