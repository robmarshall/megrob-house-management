import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryPicker } from "./CategoryPicker";
import type { RecipeCategoryType } from "@/types/recipe";

type Category = { type: RecipeCategoryType; value: string };

function Harness({
  initial = [],
  availableTags,
}: {
  initial?: Category[];
  availableTags?: string[];
}) {
  const [selected, setSelected] = useState<Category[]>(initial);
  return (
    <>
      <CategoryPicker
        selectedCategories={selected}
        onChange={setSelected}
        availableTags={availableTags}
      />
      <output data-testid="selected">{JSON.stringify(selected)}</output>
    </>
  );
}

const selected = () =>
  JSON.parse(screen.getByTestId("selected").textContent || "[]") as Category[];

describe("CategoryPicker tags", () => {
  it("offers the suggested tags and existing ones", () => {
    render(<Harness availableTags={["Camping"]} />);
    expect(screen.getByRole("button", { name: "Camping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batch cook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Freezer friendly" })).toBeInTheDocument();
  });

  it("toggles a tag on and off", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Batch cook" }));
    expect(selected()).toEqual([{ type: "tag", value: "Batch cook" }]);

    await user.click(screen.getByRole("button", { name: "Batch cook" }));
    expect(selected()).toEqual([]);
  });

  it("adds a typed tag on Enter, reusing an existing spelling", async () => {
    const user = userEvent.setup();
    render(<Harness availableTags={["Camping"]} />);

    await user.type(screen.getByLabelText("New tag"), "camping{Enter}");
    await user.type(screen.getByLabelText("New tag"), "Picnic, beach{Enter}");

    expect(selected()).toEqual([
      { type: "tag", value: "Camping" },
      { type: "tag", value: "Picnic beach" },
    ]);
    expect(screen.getByLabelText("New tag")).toHaveValue("");
  });

  it("keeps tags already on the recipe visible", () => {
    render(<Harness initial={[{ type: "tag", value: "Bonfire night" }]} />);
    expect(screen.getByRole("button", { name: "Bonfire night" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
