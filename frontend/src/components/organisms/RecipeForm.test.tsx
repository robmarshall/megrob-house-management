import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipeForm } from "./RecipeForm";
import type { Recipe } from "@/types/recipe";

/**
 * RecipeForm seeds its own useForm from `initialData`. These fixtures are valid
 * for every required field EXCEPT the ingredient name, so that on submit the
 * only Zod error produced is the nested `ingredients.0.name` error. That nested
 * error is what the bug fix surfaces into IngredientInput.
 */
function makeInitialData(ingredientName: string): Partial<Recipe> {
  return {
    name: "Test Recipe",
    servings: 4,
    // Seeds parseInstructions() -> one non-empty step, satisfying min(1).
    instructions: JSON.stringify(["Combine ingredients and cook."]),
    ingredients: [
      {
        id: 1,
        recipeId: 1,
        name: ingredientName,
        quantity: "2",
        unit: "cups",
        notes: null,
        position: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

describe("RecipeForm ingredient validation", () => {
  it("surfaces the nested ingredient-name error and blocks submit when a name is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <RecipeForm
        initialData={makeInitialData("")}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Create Recipe" }));

    // The message was absent before the fix (error was handed `undefined`).
    expect(await screen.findByText("Ingredient name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit when all fields including the ingredient name are valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <RecipeForm
        initialData={makeInitialData("Flour")}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Create Recipe" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText("Ingredient name is required")
    ).not.toBeInTheDocument();
  });
});

/**
 * The servings input previously did `parseInt(e.target.value) || 4`, so
 * clearing the field (or typing 0) snapped the value straight back to the
 * default of 4 instead of letting the user leave it empty / type 0. These
 * tests cover the fixed behavior: clearing stays empty and is caught by
 * required-field validation on submit, while a valid number still submits.
 */
describe("RecipeForm servings number input", () => {
  function getServingsInput(): HTMLInputElement {
    const label = screen.getByText("Servings");
    const wrapper = label.parentElement;
    if (!wrapper) throw new Error("Servings label has no parent wrapper");
    const input = wrapper.querySelector('input[type="number"]');
    if (!input) throw new Error("Servings input not found");
    return input as HTMLInputElement;
  }

  it("leaves the servings input empty instead of snapping back to 4, and blocks submit with a validation error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <RecipeForm
        initialData={makeInitialData("Flour")}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    const servingsInput = getServingsInput();
    expect(servingsInput).toHaveValue(4);

    await user.clear(servingsInput);

    // Was previously snapped back to 4 by the `|| 4` fallback.
    expect(servingsInput).toHaveValue(null);

    await user.click(screen.getByRole("button", { name: "Create Recipe" }));

    await waitFor(() => {
      expect(servingsInput.parentElement?.querySelector("p.text-red-600")).not.toBeNull();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the typed servings value when a valid number is entered", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <RecipeForm
        initialData={makeInitialData("Flour")}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    const servingsInput = getServingsInput();
    await user.clear(servingsInput);
    await user.type(servingsInput, "6");
    expect(servingsInput).toHaveValue(6);

    await user.click(screen.getByRole("button", { name: "Create Recipe" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submittedData = onSubmit.mock.calls[0][0] as { servings: number };
    expect(submittedData.servings).toBe(6);
  });
});

/**
 * Imported recipes can carry ingredient unit/notes values that fail validation
 * on fields with no dedicated visible input. Before the fix, those errors were
 * swallowed entirely: Save did nothing, showed nothing. These tests cover the
 * surfaced error message (and the toast fires via handleInvalidSubmit).
 */
describe("RecipeForm imported-ingredient validation errors", () => {
  it("surfaces an over-length ingredient notes error instead of failing silently", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const initialData = makeInitialData("Chicken");
    initialData.ingredients![0].notes = "x".repeat(501);

    render(
      <RecipeForm
        initialData={initialData}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Create Recipe" }));

    expect(
      await screen.findByText("Notes must be 500 characters or less")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces an over-length ingredient unit error instead of failing silently", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const initialData = makeInitialData("Chicken");
    initialData.ingredients![0].unit = "y".repeat(51);

    render(
      <RecipeForm
        initialData={initialData}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Create Recipe" }));

    expect(
      await screen.findByText("Unit must be 50 characters or less")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
