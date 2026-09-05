import { fireEvent, render, screen } from "@testing-library/react";
import { HeroUIProvider } from "@heroui/system";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./select";

describe("Select", () => {
  it("keeps nested dialog options accessible and selectable", async () => {
    function NestedSelect() {
      const [value, setValue] = useState("");
      return (
        <HeroUIProvider disableAnimation>
          <Dialog open>
            <DialogContent>
              <DialogTitle>Child categories</DialogTitle>
              <DialogDescription>Choose a bulk action.</DialogDescription>
              <Select aria-label="Bulk action" value={value} onValueChange={setValue}>
                <SelectTrigger><SelectValue placeholder="Choose an action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activate">Activate categories</SelectItem>
                  <SelectItem value="deactivate">Deactivate categories</SelectItem>
                </SelectContent>
              </Select>
            </DialogContent>
          </Dialog>
        </HeroUIProvider>
      );
    }
    render(<NestedSelect />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /choose an action bulk action/i }));
    const option = await screen.findByRole("option", { name: "Deactivate categories" });
    expect(option).toBeVisible();
    expect(dialog).toContainElement(option);
    fireEvent.click(option);
    expect(screen.getByRole("button", { name: /deactivate categories bulk action/i })).toBeVisible();
    expect(screen.getByRole("dialog")).toContainElement(screen.getByText("Child categories"));
  });

  it("renders the controlled selected item label in the trigger", () => {
    render(
      <Select aria-label="Warehouse" value="warehouse-main">
        <SelectTrigger>
          <SelectValue placeholder="Select warehouse" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__warehouse_select_empty__">Select warehouse</SelectItem>
          <SelectItem value="warehouse-main">Main Warehouse (MAIN)</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByRole("button", { name: /warehouse/i })).toHaveTextContent(
      "Main Warehouse (MAIN)"
    );
  });

  it("renders composed selected item labels in the trigger", () => {
    render(
      <Select aria-label="Warehouse" value="warehouse-main">
        <SelectTrigger>
          <SelectValue placeholder="Select warehouse" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__warehouse_select_empty__">Select warehouse</SelectItem>
          <SelectItem value="warehouse-main">
            {"Main Warehouse"} ({"MAIN"})
          </SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByRole("button", { name: /warehouse/i })).toHaveTextContent(
      "Main Warehouse (MAIN)"
    );
  });
});
