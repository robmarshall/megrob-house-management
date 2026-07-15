import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipeFilters } from "./RecipeFilters";
import type { RecipePaginationOptions } from "@/hooks/recipe/useRecipes";

/**
 * A tiny controlled wrapper that mimics how RecipesPage owns `filters` and
 * passes it down as a prop, so we can simulate the parent clearing the
 * search filter (e.g. via the "Clear Filters" action) independently of
 * RecipeFilters' own internal clear handlers.
 */
function ControlledRecipeFilters({
  initialFilters = {},
}: {
  initialFilters?: RecipePaginationOptions;
}) {
  const [filters, setFilters] = useState<RecipePaginationOptions>(initialFilters);
  return (
    <div>
      <RecipeFilters filters={filters} onFiltersChange={setFilters} />
      <button type="button" onClick={() => setFilters({})}>
        Parent Clear Filters
      </button>
    </div>
  );
}

describe("RecipeFilters", () => {
  it("clears the displayed search box when the parent clears the search filter", async () => {
    const user = userEvent.setup();
    render(<ControlledRecipeFilters />);

    const searchInput = screen.getByPlaceholderText(
      "Search recipes, ingredients..."
    ) as HTMLInputElement;

    await user.type(searchInput, "pasta");
    expect(searchInput).toHaveValue("pasta");

    // Submit so the typed value becomes the applied `search` filter,
    // mirroring the real search-on-submit flow.
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(searchInput).toHaveValue("pasta");

    // Simulate the parent (RecipesPage) clearing filters directly, bypassing
    // RecipeFilters' own clear handlers - this is the exact mechanism behind
    // the "Clear Filters" bug.
    await user.click(screen.getByRole("button", { name: "Parent Clear Filters" }));

    expect(searchInput).toHaveValue("");
  });

  it("still calls onFiltersChange with the typed search value on submit", async () => {
    const user = userEvent.setup();
    const handleFiltersChange = vi.fn();

    render(
      <RecipeFilters filters={{}} onFiltersChange={handleFiltersChange} />
    );

    const searchInput = screen.getByPlaceholderText(
      "Search recipes, ingredients..."
    );

    await user.type(searchInput, "tacos");
    expect(searchInput).toHaveValue("tacos");
    // Typing alone should not trigger a filter change (search is
    // submit-based here, not live-debounced).
    expect(handleFiltersChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(handleFiltersChange).toHaveBeenCalledWith({ search: "tacos" });
  });

  it("does not clobber in-progress typing when the search filter prop is unchanged", async () => {
    const user = userEvent.setup();
    const handleFiltersChange = vi.fn();

    const { rerender } = render(
      <RecipeFilters filters={{}} onFiltersChange={handleFiltersChange} />
    );

    const searchInput = screen.getByPlaceholderText(
      "Search recipes, ingredients..."
    );

    await user.type(searchInput, "soup");
    expect(searchInput).toHaveValue("soup");

    // Re-rendering with an unrelated filter change (search prop unchanged)
    // should not reset what the user is typing.
    rerender(
      <RecipeFilters
        filters={{ favorite: true }}
        onFiltersChange={handleFiltersChange}
      />
    );

    expect(searchInput).toHaveValue("soup");
  });
});
