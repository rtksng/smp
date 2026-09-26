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

  it("summarises the visible range and collapses distant pages behind an ellipsis", () => {
    const onChange = vi.fn();

    render(
      <PaginationControls
        ariaLabel="Rules pagination"
        onChange={onChange}
        page={5}
        pageSize={20}
        totalItems={240}
        totalPages={12}
      />
    );

    expect(screen.getByText("Showing 81–100 of 240")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Rules pagination" })).toHaveTextContent(
      "1…456…12"
    );
    expect(screen.getByText("Page 5 of 12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to page 5" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to page 5" }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Go to page 12" }));
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("shows the range for a single page without navigation and hides entirely when empty", () => {
    const { rerender } = render(
      <PaginationControls onChange={vi.fn()} page={1} pageSize={20} totalItems={7} totalPages={1} />
    );

    expect(screen.getByText("Showing 1–7 of 7")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    rerender(
      <PaginationControls onChange={vi.fn()} page={1} pageSize={20} totalItems={0} totalPages={0} />
    );
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
});
