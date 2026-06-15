import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Category } from "../../lib/api/schemas";
import { CategoryShowcase } from "./category-showcase";

const categories: Category[] = [
  {
    children: [
      {
        children: [],
        description: null,
        id: "sutures",
        imageUrl: null,
        isActive: true,
        name: "Sutures",
        parentId: "consumables",
        slug: "sutures",
        sortOrder: 1
      }
    ],
    description: "Daily-use medical consumables",
    id: "consumables",
    imageUrl: null,
    isActive: true,
    name: "Consumables",
    parentId: null,
    slug: "consumables",
    sortOrder: 1
  }
];

describe("CategoryShowcase", () => {
  it("renders category and subcategory navigation from category API data", () => {
    render(<CategoryShowcase categories={categories} />);

    expect(screen.getByRole("link", { name: /Consumables/i })).toHaveAttribute(
      "href",
      "/categories/consumables"
    );
    expect(screen.getByRole("link", { name: "Sutures" })).toHaveAttribute(
      "href",
      "/categories/consumables?subcategory=sutures"
    );
  });
});
