import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./select";

describe("Select", () => {
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
