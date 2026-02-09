/**
 * Parsed ingredient data
 */
export interface ParsedIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
  notes: string | null;
}

/**
 * Common cooking units for matching
 */
const UNITS = new Set([
  // Volume
  'cup', 'cups', 'c',
  'tablespoon', 'tablespoons', 'tbsp', 'tbs', 'tb',
  'teaspoon', 'teaspoons', 'tsp', 'ts',
  'fluid ounce', 'fluid ounces', 'fl oz',
  'pint', 'pints', 'pt',
  'quart', 'quarts', 'qt',
  'gallon', 'gallons', 'gal',
  'milliliter', 'milliliters', 'ml',
  'liter', 'liters', 'l',

  // Weight
  'pound', 'pounds', 'lb', 'lbs',
  'ounce', 'ounces', 'oz',
  'gram', 'grams', 'g',
  'kilogram', 'kilograms', 'kg',

  // Count/other
  'piece', 'pieces', 'pc', 'pcs',
  'slice', 'slices',
  'clove', 'cloves',
  'head', 'heads',
  'bunch', 'bunches',
  'can', 'cans',
  'package', 'packages', 'pkg',
  'bag', 'bags',
  'stick', 'sticks',
  'pinch', 'pinches',
  'dash', 'dashes',
  'sprig', 'sprigs',
  'stalk', 'stalks',
  'leaf', 'leaves',
  'handful', 'handfuls',

  // Size-based
  'small', 'medium', 'large',
]);

/**
 * Unicode fraction mappings
 */
const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

/**
 * Normalize unit to a standard form
 */
function normalizeUnit(unit: string): string {
  const lowerUnit = unit.toLowerCase().trim();

  // Map variations to standard forms
  const unitMap: Record<string, string> = {
    'c': 'cups',
    'cup': 'cups',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'tbs': 'tbsp',
    'tb': 'tbsp',
    'teaspoon': 'tsp',
    'teaspoons': 'tsp',
    'ts': 'tsp',
    'pound': 'lb',
    'pounds': 'lb',
    'lbs': 'lb',
    'ounce': 'oz',
    'ounces': 'oz',
    'gram': 'g',
    'grams': 'g',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'liter': 'L',
    'liters': 'L',
    'l': 'L',
    'piece': 'pieces',
    'pc': 'pieces',
    'pcs': 'pieces',
    'slice': 'slices',
    'clove': 'cloves',
    'package': 'pkg',
    'packages': 'pkg',
  };

  return unitMap[lowerUnit] || lowerUnit;
}

/**
 * Parse a fraction string to a decimal number
 * Handles: "1/2", "1 1/2", "½", "1½"
 */
function parseFraction(str: string): number | null {
  // Check for unicode fractions
  for (const [char, value] of Object.entries(UNICODE_FRACTIONS)) {
    if (str.includes(char)) {
      // Check for whole number + fraction (e.g., "1½")
      const wholeMatch = str.match(/^(\d+)/);
      const whole = wholeMatch ? parseInt(wholeMatch[1], 10) : 0;
      return whole + value;
    }
  }

  // Check for regular fractions (e.g., "1/2")
  const fractionMatch = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    if (denominator !== 0) {
      return numerator / denominator;
    }
  }

  // Check for mixed numbers (e.g., "1 1/2")
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    if (denominator !== 0) {
      return whole + numerator / denominator;
    }
  }

  // Check for decimal
  const decimalMatch = str.match(/^(\d+(?:\.\d+)?)$/);
  if (decimalMatch) {
    return parseFloat(decimalMatch[1]);
  }

  return null;
}

/**
 * Parse a quantity string that may contain ranges or fractions
 */
function parseQuantity(str: string): number | null {
  str = str.trim();

  // Handle ranges (e.g., "2-3", "2 to 3") - use the first number
  const rangeMatch = str.match(/^([\d\s\/½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞.]+)(?:\s*[-–—to]\s*[\d\s\/½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞.]+)?/i);
  if (rangeMatch) {
    return parseFraction(rangeMatch[1].trim());
  }

  return parseFraction(str);
}

/**
 * Extract notes from ingredient text (text in parentheses or after comma)
 */
function extractNotes(text: string): { cleanText: string; notes: string | null } {
  let notes: string[] = [];
  let cleanText = text;

  // Extract parenthetical notes
  const parenMatches = text.matchAll(/\(([^)]+)\)/g);
  for (const match of parenMatches) {
    notes.push(match[1].trim());
    cleanText = cleanText.replace(match[0], ' ');
  }

  // Extract comma-separated notes (common descriptors)
  const descriptorPattern = /,\s*((?:finely |roughly |freshly |thinly |coarsely )?(?:chopped|minced|diced|sliced|grated|crushed|peeled|seeded|julienned|cubed|melted|softened|room temperature|at room temperature|divided|optional|to taste|for garnish|for serving|packed))/gi;
  const descriptorMatches = cleanText.matchAll(descriptorPattern);
  for (const match of descriptorMatches) {
    notes.push(match[1].trim());
    cleanText = cleanText.replace(match[0], '');
  }

  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  return {
    cleanText,
    notes: notes.length > 0 ? notes.join(', ') : null,
  };
}

/**
 * Parse an ingredient string into structured data
 *
 * Examples:
 * - "2 cups all-purpose flour" -> { quantity: 2, unit: "cups", name: "all-purpose flour", notes: null }
 * - "1/2 cup butter, melted" -> { quantity: 0.5, unit: "cups", name: "butter", notes: "melted" }
 * - "3 large eggs" -> { quantity: 3, unit: "large", name: "eggs", notes: null }
 * - "Salt to taste" -> { quantity: null, unit: null, name: "Salt", notes: "to taste" }
 */
export function parseIngredient(text: string): ParsedIngredient {
  // First extract notes
  const { cleanText, notes } = extractNotes(text);

  // Tokenize the remaining text
  const tokens = cleanText.split(/\s+/);

  if (tokens.length === 0) {
    return { quantity: null, unit: null, name: text.trim(), notes };
  }

  let quantity: number | null = null;
  let unit: string | null = null;
  let nameStartIndex = 0;

  // Try to parse quantity from first token(s)
  // Handle cases like "1", "1/2", "1 1/2", "1½"
  const firstToken = tokens[0];
  quantity = parseQuantity(firstToken);

  if (quantity !== null) {
    nameStartIndex = 1;

    // Check if second token continues the quantity (e.g., "1 1/2")
    if (tokens.length > 1) {
      const secondToken = tokens[1];
      const combinedQuantity = parseQuantity(`${firstToken} ${secondToken}`);
      if (combinedQuantity !== null && combinedQuantity !== quantity) {
        quantity = combinedQuantity;
        nameStartIndex = 2;
      }
    }
  }

  // Try to parse unit from next token
  if (tokens.length > nameStartIndex) {
    const possibleUnit = tokens[nameStartIndex].toLowerCase().replace(/[.,]/g, '');
    if (UNITS.has(possibleUnit)) {
      unit = normalizeUnit(possibleUnit);
      nameStartIndex++;
    }
  }

  // Check for "of" after unit (e.g., "2 cups of flour")
  if (tokens.length > nameStartIndex && tokens[nameStartIndex].toLowerCase() === 'of') {
    nameStartIndex++;
  }

  // Rest is the ingredient name
  const name = tokens.slice(nameStartIndex).join(' ').trim() || text.trim();

  return {
    quantity,
    unit,
    name,
    notes,
  };
}

/**
 * Scale an ingredient's quantity by a multiplier
 */
export function scaleIngredient(
  ingredient: ParsedIngredient,
  multiplier: number
): ParsedIngredient {
  return {
    ...ingredient,
    quantity: ingredient.quantity !== null ? ingredient.quantity * multiplier : null,
  };
}

/**
 * Format a parsed ingredient back to a string
 */
export function formatIngredient(ingredient: ParsedIngredient): string {
  const parts: string[] = [];

  if (ingredient.quantity !== null) {
    // Format quantity nicely (avoid ugly decimals)
    const q = ingredient.quantity;
    if (Number.isInteger(q)) {
      parts.push(q.toString());
    } else if (Math.abs(q - 0.25) < 0.001) {
      parts.push('1/4');
    } else if (Math.abs(q - 0.5) < 0.001) {
      parts.push('1/2');
    } else if (Math.abs(q - 0.75) < 0.001) {
      parts.push('3/4');
    } else if (Math.abs(q - 0.333) < 0.01) {
      parts.push('1/3');
    } else if (Math.abs(q - 0.667) < 0.01) {
      parts.push('2/3');
    } else {
      parts.push(q.toFixed(2).replace(/\.?0+$/, ''));
    }
  }

  if (ingredient.unit) {
    parts.push(ingredient.unit);
  }

  parts.push(ingredient.name);

  if (ingredient.notes) {
    parts.push(`(${ingredient.notes})`);
  }

  return parts.join(' ');
}
