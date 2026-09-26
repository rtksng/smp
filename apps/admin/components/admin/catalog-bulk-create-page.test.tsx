import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogBulkCreatePage } from "./catalog-bulk-create-page";

describe("CatalogBulkCreatePage", () => {
  it("uses a responsive page layout with independently scrollable desktop rows", () => {
    const styles = readFileSync(
      join(__dirname, "catalog-bulk-create-page.css"),
      "utf8"
    );

    expect(styles).toContain(".catalogBulkCreatePage");
    expect(styles).toMatch(/\.catalogBulkRows\s*\{[\s\S]*?overflow-y: auto/);
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.catalogBulkRows\s*\{[\s\S]*?overflow: visible/
    );
  });

  it("scrolls the row table to the bottom after Add row is clicked", async () => {
    render(
      <CatalogBulkCreatePage
        backHref="/brands"
        existingSlugs={[]}
        kind="brand"
        onComplete={vi.fn()}
        onCreate={vi.fn()}
      />
    );

    const rows = screen.getByLabelText("brands to create");
    Object.defineProperty(rows, "scrollHeight", {
      configurable: true,
      value: 640
    });

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));

    await waitFor(() => expect(rows.scrollTop).toBe(640));
  });

  it("creates pasted brand names sequentially with generated slugs", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn().mockResolvedValue(undefined);

    render(
      <CatalogBulkCreatePage
        backHref="/brands"
        existingSlugs={[]}
        kind="brand"
        onComplete={onComplete}
        onCreate={onCreate}
      />
    );

    fireEvent.change(screen.getByLabelText("Paste brand names"), {
      target: { value: "Acme Surgical\nMediCore" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add names" }));

    expect(screen.getByLabelText("Brand name row 1")).toHaveValue("Acme Surgical");
    expect(screen.getByLabelText("Brand slug row 1")).toHaveValue("acme-surgical");
    expect(screen.getByLabelText("Brand name row 2")).toHaveValue("MediCore");

    fireEvent.click(screen.getByRole("button", { name: "Create 2 brands" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
    expect(onCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "Acme Surgical", slug: "acme-surgical" })
    );
    expect(onCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: "MediCore", slug: "medicore" })
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(2));
    expect(
      screen.getByText("2", { selector: ".catalogBulkSummary strong" })
    ).toBeInTheDocument();
  }, 15000);

  it("shows validation errors without sending an existing brand slug", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <CatalogBulkCreatePage
        backHref="/brands"
        existingSlugs={["existing-brand"]}
        kind="brand"
        onComplete={vi.fn()}
        onCreate={onCreate}
      />
    );

    fireEvent.change(screen.getByLabelText("Brand name row 1"), {
      target: { value: "Existing Brand" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create 1 brand" }));

    expect(await screen.findByText("This slug already exists.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
