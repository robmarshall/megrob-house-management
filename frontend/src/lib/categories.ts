import type { BadgeVariant } from "@/components/atoms/Badge";

/**
 * Single source of truth for shopping list categories.
 *
 * Each entry maps a stored category slug (a `BadgeVariant`) to the
 * user-facing friendly name. The order here is the order used in the
 * "Add Item" category dropdown.
 */
export const SHOPPING_CATEGORIES: { slug: BadgeVariant; name: string }[] = [
  { slug: "fruitveg", name: "Fruit & Veg" },
  { slug: "dairy", name: "Dairy" },
  { slug: "meat", name: "Meat" },
  { slug: "fish", name: "Fish" },
  { slug: "bakery", name: "Bakery" },
  { slug: "pantry", name: "Pantry" },
  { slug: "frozen", name: "Frozen" },
  { slug: "beverages", name: "Beverages" },
  { slug: "household", name: "Household" },
  { slug: "toiletries", name: "Toiletries" },
  { slug: "medicine", name: "Medicine" },
  { slug: "other", name: "Other" },
  { slug: "default", name: "Uncategorized" },
];

const CATEGORY_LABELS: Record<string, string> = SHOPPING_CATEGORIES.reduce(
  (acc, { slug, name }) => {
    acc[slug] = name;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Returns the friendly display name for a category slug.
 *
 * `null`, `undefined`, `""`, and the `default` slug all resolve to
 * "Uncategorized" so that `default`-slug items merge into the same
 * group as items with no category. Unknown slugs fall back to a
 * title-cased version of the slug.
 */
export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) {
    return "Uncategorized";
  }

  const known = CATEGORY_LABELS[slug];
  if (known) {
    return known;
  }

  return slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase();
}
