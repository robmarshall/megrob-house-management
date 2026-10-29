import type { RecipeCategoryType } from "@/types/recipe";

export const CATEGORY_TYPES: readonly RecipeCategoryType[] = [
  "meal_type",
  "dietary",
  "allergen",
  "tag",
];

/** Lower-cased spellings seen in the wild, mapped to the canonical type. */
const CATEGORY_TYPE_ALIASES: Record<string, RecipeCategoryType> = {
  meal: "meal_type",
  mealtype: "meal_type",
  "meal-type": "meal_type",
  meal_type: "meal_type",
  course: "meal_type",
  diet: "dietary",
  dietary: "dietary",
  allergen: "allergen",
  allergens: "allergen",
  allergy: "allergen",
  tag: "tag",
  tags: "tag",
};

export interface NormalizedCategories {
  categories: Array<{ type: RecipeCategoryType; value: string }>;
  /** Tags whose type couldn't be mapped; shown to the user and not re-saved. */
  dropped: Array<{ type: string; value: string }>;
}

/**
 * Map stored category rows to the recipe form's { type, value } shape,
 * coercing legacy/alias type names to the types the schema accepts.
 *
 * Recipes created via the API/MCP before category types were locked down can
 * carry tags like "meal" or "dish". The form schema rejects those, and since
 * the tag has no visible input the save used to fail with nothing to point
 * at. Known aliases are coerced; anything else is reported in `dropped` so
 * the form can tell the user before it is discarded on save.
 */
export function normalizeCategories(
  categories?: Array<{ categoryType: string; categoryValue: string }>
): NormalizedCategories {
  const result: NormalizedCategories = { categories: [], dropped: [] };
  if (!categories) return result;

  for (const category of categories) {
    const raw = String(category.categoryType ?? "");
    const mapped =
      CATEGORY_TYPES.find((t) => t === raw) ??
      CATEGORY_TYPE_ALIASES[raw.trim().toLowerCase()];
    if (mapped) {
      result.categories.push({ type: mapped, value: category.categoryValue });
    } else {
      result.dropped.push({ type: raw, value: category.categoryValue });
    }
  }
  return result;
}
