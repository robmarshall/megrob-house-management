import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddItemBottomSheet from "./AddItemBottomSheet";

describe("AddItemBottomSheet quantity input", () => {
  it("clears the displayed value instead of snapping back to the default of 1", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddItemBottomSheet isOpen={true} onClose={vi.fn()} onAdd={onAdd} />
    );

    const quantityInput = screen.getByLabelText("Quantity");
    expect(quantityInput).toHaveValue(1);

    await user.clear(quantityInput);

    expect(quantityInput).toHaveValue(null);
  });

  it("shows 0 instead of snapping back to the default of 1 when 0 is typed", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddItemBottomSheet isOpen={true} onClose={vi.fn()} onAdd={onAdd} />
    );

    const quantityInput = screen.getByLabelText("Quantity");

    await user.clear(quantityInput);
    await user.type(quantityInput, "0");

    expect(quantityInput).toHaveValue(0);
  });

  it("submits with the typed quantity when a valid number is entered", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddItemBottomSheet isOpen={true} onClose={vi.fn()} onAdd={onAdd} />
    );

    await user.type(screen.getByPlaceholderText("Enter item name..."), "Milk");

    const quantityInput = screen.getByLabelText("Quantity");
    await user.clear(quantityInput);
    await user.type(quantityInput, "3");

    await user.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("Milk", undefined, 3, undefined);
  });

  it("submits with the default quantity of 1 when the quantity is cleared", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddItemBottomSheet isOpen={true} onClose={vi.fn()} onAdd={onAdd} />
    );

    await user.type(screen.getByPlaceholderText("Enter item name..."), "Eggs");
    await user.clear(screen.getByLabelText("Quantity"));

    await user.click(screen.getByRole("button", { name: "Add Item" }));

    // Not silently blocked: submit succeeds and quantity defaults to 1.
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("Eggs", undefined, 1, undefined);
  });
});
