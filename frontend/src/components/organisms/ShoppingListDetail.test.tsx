import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShoppingListDetail } from "./ShoppingListDetail";
import type {
  ShoppingList,
  ShoppingListItem,
} from "@/types/shoppingList";

function makeItem(
  overrides: Partial<ShoppingListItem> & Pick<ShoppingListItem, "id">
): ShoppingListItem {
  return {
    listId: 1,
    name: "Item",
    category: null,
    quantity: 1,
    unit: null,
    notes: null,
    checked: false,
    checkedAt: null,
    checkedBy: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides,
  };
}

const list: ShoppingList = {
  id: 1,
  name: "Groceries",
  description: "Weekly shopping",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "user-1",
  updatedBy: "user-1",
  items: [
    makeItem({ id: 1, name: "Apples", category: "fruitveg" }),
    makeItem({ id: 2, name: "Mystery", category: "default" }),
    makeItem({ id: 3, name: "Loose", category: null }),
  ],
};

describe("ShoppingListDetail category grouping", () => {
  it("uses friendly labels and merges default + null into one Uncategorized group", () => {
    render(
      <ShoppingListDetail
        list={list}
        onAddItem={vi.fn()}
        onToggleItem={vi.fn()}
        onDeleteItem={vi.fn()}
      />
    );

    // Friendly label for the fruitveg slug.
    expect(
      screen.getByRole("heading", { name: "Fruit & Veg" })
    ).toBeInTheDocument();

    // The raw title-cased slugs must NOT appear as headings.
    expect(
      screen.queryByRole("heading", { name: "Fruitveg" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Default" })
    ).not.toBeInTheDocument();

    // default + null items merge into a single Uncategorized group.
    const uncategorized = screen.getAllByRole("heading", {
      name: "Uncategorized",
    });
    expect(uncategorized).toHaveLength(1);
  });
});
