/**
 * Unit-to-mass conversion for nutrition calculation.
 *
 * Mass units convert to grams exactly. Volume and count units depend on the
 * food itself (a cup of flour ≠ a cup of water), so those conversions come
 * from the ingredient food cache / estimator — this module only identifies
 * them and provides the exact mass conversions.
 *
 * All unit names here are CANONICAL forms from canonicalizeUnit (units.ts).
 */

import { canonicalizeUnit } from './units.js';

/** Grams per one canonical mass unit. */
const MASS_UNIT_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.35,
  lb: 453.6,
};

/** Sentinel unit used for unitless ingredient quantities ("2 onions"). */
export const ITEM_UNIT = 'item';

/**
 * Cache-key unit for an ingredient: all mass units collapse to 'g' (their
 * per-100g nutrition is unit-independent); everything else keeps its
 * canonical unit because grams-per-unit depends on the food.
 */
export function cacheUnit(unit: string | null | undefined): string {
  const canonical = unit ? canonicalizeUnit(unit) : ITEM_UNIT;
  return canonical in MASS_UNIT_GRAMS ? 'g' : canonical;
}

export function isMassUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  return canonicalizeUnit(unit) in MASS_UNIT_GRAMS;
}

/**
 * Convert a quantity of a mass unit to grams. Returns null for non-mass
 * units (use the food cache's gramsPerUnit for those).
 */
export function massToGrams(
  quantity: number,
  unit: string | null | undefined
): number | null {
  if (!unit) return null;
  const perUnit = MASS_UNIT_GRAMS[canonicalizeUnit(unit)];
  return perUnit === undefined ? null : quantity * perUnit;
}
