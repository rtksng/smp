import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("keeps selection behavior without forwarding HeroUI state props to the SVG", () => {
    const onCheckedChange = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const { container, rerender } = render(
        <Checkbox aria-label="Select inventory" checked={false} onCheckedChange={onCheckedChange} />
      );
      fireEvent.click(screen.getByRole("checkbox", { name: "Select inventory" }));
      expect(onCheckedChange).toHaveBeenCalledWith(true);
      rerender(<Checkbox aria-label="Select inventory" checked onCheckedChange={onCheckedChange} />);
      expect(screen.getByRole("checkbox", { name: "Select inventory" })).toBeChecked();
      const icon = container.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).not.toHaveAttribute("isSelected");
      expect(icon).not.toHaveAttribute("isIndeterminate");
      expect(icon).not.toHaveAttribute("disableAnimation");
      expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/isSelected|isIndeterminate|disableAnimation/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
