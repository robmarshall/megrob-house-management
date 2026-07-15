/**
 * Canonical unit normalization — single source of truth.
 *
 * Both the ingredient parser (recipe/meal-plan -> shopping-list flows) and the
 * item matcher (duplicate detection / merging) MUST use this function so that
 * units stored by different code paths canonicalize to the same form and merge
 * correctly (e.g. `cup` vs `cups`, `lb` vs `lbs`).
 */

/**
 * Map unit variations to their canonical form. Keys are lowercased/trimmed.
 */
const UNIT_MAP: Record<string, string> = {
  c: 'cups',
  cup: 'cups',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbs: 'tbsp',
  tb: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  ts: 'tsp',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  ounce: 'oz',
  ounces: 'oz',
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  'fl oz': 'fl oz',
  milliliter: 'ml',
  milliliters: 'ml',
  liter: 'L',
  liters: 'L',
  l: 'L',
  piece: 'pieces',
  pc: 'pieces',
  pcs: 'pieces',
  slice: 'slices',
  clove: 'cloves',
  package: 'pkg',
  packages: 'pkg',
};

/**
 * Canonicalize a unit string to a standard form.
 *
 * Lowercases and trims the input, then maps known variations to their canonical
 * form. Unknown units pass through as their lowercased/trimmed form.
 */
export function canonicalizeUnit(unit: string): string {
  const lowerUnit = unit.toLowerCase().trim();
  return UNIT_MAP[lowerUnit] || lowerUnit;
}
