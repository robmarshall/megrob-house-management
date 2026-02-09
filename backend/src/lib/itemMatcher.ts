/**
 * Item matching utilities for shopping list duplicate detection.
 * Handles fuzzy name matching (singular/plural) and unit comparison.
 */

/**
 * Normalize a word to its singular form for comparison.
 * Uses simple English pluralization rules with common food item irregulars.
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase().trim();

  // Irregular plurals (common food items)
  const irregulars: Record<string, string> = {
    potatoes: 'potato',
    tomatoes: 'tomato',
    leaves: 'leaf',
    loaves: 'loaf',
    halves: 'half',
    knives: 'knife',
    shelves: 'shelf',
    calves: 'calf',
    wolves: 'wolf',
    wives: 'wife',
    children: 'child',
    people: 'person',
    teeth: 'tooth',
    feet: 'foot',
    geese: 'goose',
    mice: 'mouse',
    dice: 'die',
    cherries: 'cherry',
    berries: 'berry',
    strawberries: 'strawberry',
    blueberries: 'blueberry',
    raspberries: 'raspberry',
    blackberries: 'blackberry',
    cranberries: 'cranberry',
    anchovies: 'anchovy',
  };

  if (irregulars[lower]) {
    return irregulars[lower];
  }

  // Rules applied in order of specificity
  if (lower.endsWith('ies') && lower.length > 3) {
    // berries -> berry, cherries -> cherry (not in irregulars map)
    return lower.slice(0, -3) + 'y';
  }
  if (lower.endsWith('ves') && lower.length > 3) {
    // calves -> calf (not in irregulars map)
    return lower.slice(0, -3) + 'f';
  }
  if (lower.endsWith('es') && lower.length > 2) {
    const stem = lower.slice(0, -2);
    // boxes -> box, dishes -> dish, tomatoes -> tomato
    if (
      stem.endsWith('sh') ||
      stem.endsWith('ch') ||
      stem.endsWith('ss') ||
      stem.endsWith('x') ||
      stem.endsWith('z') ||
      stem.endsWith('o')
    ) {
      return stem;
    }
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 1) {
    // carrots -> carrot
    return lower.slice(0, -1);
  }

  return lower;
}

/**
 * Normalize an item name for comparison.
 * Handles singular/plural and case insensitivity.
 */
export function normalizeItemName(name: string): string {
  const cleaned = name.toLowerCase().trim();
  const words = cleaned.split(/\s+/);
  const normalized = words.map((word) => singularize(word));
  return normalized.join(' ');
}

/**
 * Check if two item names match (fuzzy singular/plural matching).
 */
export function namesMatch(name1: string, name2: string): boolean {
  return normalizeItemName(name1) === normalizeItemName(name2);
}

/**
 * Normalize a unit for comparison.
 * Both null and empty string match as "no unit".
 */
export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit || unit.trim() === '') {
    return null;
  }
  return unit.toLowerCase().trim();
}

/**
 * Check if two units match.
 * null, undefined, and '' all match each other.
 */
export function unitsMatch(
  unit1: string | null | undefined,
  unit2: string | null | undefined
): boolean {
  return normalizeUnit(unit1) === normalizeUnit(unit2);
}

/**
 * Combine notes from two items, avoiding duplicates.
 */
export function combineNotes(
  existingNotes: string | null | undefined,
  newNotes: string | null | undefined
): string | null {
  const existing = existingNotes?.trim() || '';
  const incoming = newNotes?.trim() || '';

  if (!existing && !incoming) return null;
  if (!existing) return incoming;
  if (!incoming) return existing;

  // Check if notes are identical
  if (existing === incoming) return existing;

  // Check if existing already contains the new note
  if (existing.includes(incoming)) return existing;

  // Combine with separator
  return `${existing}; ${incoming}`;
}

/**
 * Interface for item matching
 */
export interface MatchableItem {
  id: number;
  name: string;
  unit: string | null;
  quantity: string | null;
  notes: string | null;
  checked: boolean;
}

/**
 * Find a matching unchecked item in the list.
 */
export function findMatchingItem(
  newName: string,
  newUnit: string | null | undefined,
  existingItems: MatchableItem[]
): MatchableItem | null {
  for (const item of existingItems) {
    // Skip checked items
    if (item.checked) continue;

    // Check name match (fuzzy)
    if (!namesMatch(newName, item.name)) continue;

    // Check unit match (exact, with null normalization)
    if (!unitsMatch(newUnit, item.unit)) continue;

    return item;
  }

  return null;
}
