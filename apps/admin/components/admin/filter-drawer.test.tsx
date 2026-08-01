import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FilterDrawer } from "./filter-drawer";

function FilterDrawerProbe() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} type="button">
        Add filter
      </button>
      <FilterDrawer
        isOpen={isOpen}
        onApply={(event) => event.preventDefault()}
        onOpenChange={setIsOpen}
        title="Dashboard filters"
      >
        <label htmlFor="test-filter">Warehouse</label>
        <input id="test-filter" />
      </FilterDrawer>
    </>
  );
}

describe("FilterDrawer", () => {
  it("opens from its trigger and closes from the close control", async () => {
    render(<FilterDrawerProbe />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Dashboard filters");
    expect(screen.getByLabelText("Warehouse")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close filters" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
