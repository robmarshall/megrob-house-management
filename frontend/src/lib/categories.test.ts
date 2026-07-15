import { describe, it, expect } from "vitest";
import { SHOPPING_CATEGORIES, categoryLabel } from "./categories";

describe("categoryLabel", () => {
  it("maps known slugs to their friendly names", () => {
    expect(categoryLabel("fruitveg")).toBe("Fruit & Veg");
    expect(categoryLabel("dairy")).toBe("Dairy");
  });

  it("merges the default slug into Uncategorized", () => {
    expect(categoryLabel("default")).toBe("Uncategorized");
  });

  it("treats null, undefined, and empty string as Uncategorized", () => {
    expect(categoryLabel(null)).toBe("Uncategorized");
    expect(categoryLabel(undefined)).toBe("Uncategorized");
    expect(categoryLabel("")).toBe("Uncategorized");
  });

  it("title-cases an unknown slug", () => {
    expect(categoryLabel("snacks")).toBe("Snacks");
  });
});

describe("SHOPPING_CATEGORIES", () => {
  it("contains the expected slugs in order", () => {
    expect(SHOPPING_CATEGORIES.map((c) => c.slug)).toEqual([
      "fruitveg",
      "dairy",
      "meat",
      "fish",
      "bakery",
      "pantry",
      "frozen",
      "beverages",
      "household",
      "toiletries",
      "medicine",
      "other",
      "default",
    ]);
  });
});
