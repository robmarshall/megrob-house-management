/**
 * Allergen types that can be detected
 */
export type AllergenType =
  | 'nuts'
  | 'eggs'
  | 'dairy'
  | 'gluten'
  | 'shellfish'
  | 'soy'
  | 'fish';

/**
 * Dietary types that can be detected
 */
export type DietaryType =
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian';

/**
 * Keywords that indicate specific allergens
 */
const ALLERGEN_KEYWORDS: Record<AllergenType, string[]> = {
  nuts: [
    'almond', 'almonds',
    'walnut', 'walnuts',
    'pecan', 'pecans',
    'cashew', 'cashews',
    'pistachio', 'pistachios',
    'hazelnut', 'hazelnuts',
    'macadamia', 'macadamias',
    'brazil nut', 'brazil nuts',
    'pine nut', 'pine nuts',
    'peanut', 'peanuts', 'peanut butter',
    'nut', 'nuts',
    'praline',
    'marzipan',
    'nougat',
    'nutella',
  ],
  eggs: [
    'egg', 'eggs',
    'egg white', 'egg whites',
    'egg yolk', 'egg yolks',
    'mayonnaise', 'mayo',
    'meringue',
    'custard',
    'aioli',
    'hollandaise',
    'bearnaise',
  ],
  dairy: [
    'milk',
    'cream', 'heavy cream', 'whipping cream', 'sour cream', 'cream cheese',
    'cheese', 'cheddar', 'mozzarella', 'parmesan', 'gruyere', 'brie', 'feta', 'gouda', 'ricotta', 'mascarpone', 'gorgonzola', 'camembert', 'swiss cheese', 'provolone', 'cottage cheese',
    'butter', 'unsalted butter', 'salted butter',
    'yogurt', 'yoghurt', 'greek yogurt',
    'ghee',
    'buttermilk',
    'condensed milk', 'evaporated milk',
    'half and half', 'half-and-half',
    'whey',
    'casein',
    'lactose',
    'creme fraiche', 'crème fraîche',
    'ice cream',
    'gelato',
    'paneer',
    'quark',
    'kefir',
  ],
  gluten: [
    'flour', 'all-purpose flour', 'bread flour', 'cake flour', 'whole wheat flour', 'wheat flour', 'self-rising flour',
    'bread', 'breadcrumbs', 'bread crumbs', 'panko',
    'pasta', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'macaroni', 'lasagna', 'noodles', 'ramen', 'udon',
    'wheat', 'whole wheat',
    'barley',
    'rye',
    'spelt',
    'semolina',
    'couscous',
    'bulgur',
    'farro',
    'seitan',
    'soy sauce', // traditional soy sauce contains wheat
    'teriyaki sauce',
    'malt', 'malt vinegar', 'malted',
    'beer',
    'ale',
    'croutons',
    'tortilla', // flour tortillas
    'pita', 'pita bread',
    'naan',
    'baguette',
    'croissant',
  ],
  shellfish: [
    'shrimp', 'shrimps', 'prawns', 'prawn',
    'crab', 'crab meat', 'crabmeat',
    'lobster',
    'crawfish', 'crayfish', 'crawdad',
    'oyster', 'oysters',
    'mussel', 'mussels',
    'clam', 'clams',
    'scallop', 'scallops',
    'squid', 'calamari',
    'octopus',
    'abalone',
    'snail', 'escargot',
    'conch',
  ],
  soy: [
    'soy', 'soya',
    'soy sauce', 'soya sauce',
    'tofu',
    'tempeh',
    'edamame',
    'miso',
    'soy milk', 'soya milk', 'soymilk',
    'soybean', 'soybeans', 'soya bean', 'soya beans',
    'soy protein',
    'textured vegetable protein', 'tvp',
    'tamari',
    'natto',
  ],
  fish: [
    'fish',
    'salmon',
    'tuna',
    'cod',
    'tilapia',
    'halibut',
    'trout',
    'sardine', 'sardines',
    'anchovy', 'anchovies',
    'mackerel',
    'herring',
    'bass', 'sea bass',
    'catfish',
    'snapper',
    'swordfish',
    'mahi mahi', 'mahi-mahi',
    'flounder',
    'sole',
    'haddock',
    'perch',
    'pike',
    'carp',
    'fish sauce',
    'worcestershire sauce', // contains anchovies
  ],
};

/**
 * Keywords that indicate meat (for vegetarian/vegan detection)
 */
const MEAT_KEYWORDS = [
  'beef', 'steak', 'ground beef', 'mince', 'minced beef',
  'pork', 'bacon', 'ham', 'sausage', 'prosciutto', 'pancetta', 'chorizo', 'pepperoni', 'salami',
  'chicken', 'turkey', 'duck', 'goose', 'quail', 'pheasant',
  'lamb', 'mutton',
  'veal',
  'venison',
  'rabbit',
  'bison', 'buffalo',
  'goat',
  'meat', 'meatball', 'meatballs',
  'hot dog', 'hotdog',
  'bratwurst',
  'kielbasa',
  'bone broth',
  'chicken stock', 'beef stock', 'pork stock',
  'chicken broth', 'beef broth',
  'lard',
  'gelatin', 'gelatine', // animal-derived
  'suet',
  'drippings',
];

/**
 * Fish keywords for pescatarian detection
 */
const FISH_KEYWORDS = [
  ...ALLERGEN_KEYWORDS.fish,
  ...ALLERGEN_KEYWORDS.shellfish,
];

/**
 * Animal product keywords for vegan detection
 */
const ANIMAL_PRODUCT_KEYWORDS = [
  ...ALLERGEN_KEYWORDS.eggs,
  ...ALLERGEN_KEYWORDS.dairy,
  'honey',
  'beeswax',
  'gelatin', 'gelatine',
  'bone char',
  'carmine', 'cochineal',
  'isinglass',
  'shellac',
  'lanolin',
  'whey',
  'casein',
  'lactose',
];

/**
 * Normalize text for matching (lowercase, remove extra spaces)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if an ingredient contains any of the given keywords
 */
function containsKeyword(ingredient: string, keywords: string[]): boolean {
  const normalized = normalizeText(ingredient);

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);

    // Check for whole word match to avoid false positives
    // e.g., "coconut" should not match "nut"
    const regex = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i');
    if (regex.test(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect allergens in a list of ingredients
 *
 * @param ingredients - Array of ingredient strings
 * @returns Array of detected allergen types
 */
export function detectAllergens(ingredients: string[]): AllergenType[] {
  const detectedAllergens = new Set<AllergenType>();

  for (const ingredient of ingredients) {
    for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
      if (containsKeyword(ingredient, keywords)) {
        detectedAllergens.add(allergen as AllergenType);
      }
    }
  }

  return Array.from(detectedAllergens);
}

/**
 * Detect dietary classifications based on ingredients
 *
 * @param ingredients - Array of ingredient strings
 * @returns Array of dietary types that apply (empty if none)
 */
export function detectDietary(ingredients: string[]): DietaryType[] {
  const dietary: DietaryType[] = [];

  let hasMeat = false;
  let hasFish = false;
  let hasAnimalProducts = false;

  for (const ingredient of ingredients) {
    if (containsKeyword(ingredient, MEAT_KEYWORDS)) {
      hasMeat = true;
    }
    if (containsKeyword(ingredient, FISH_KEYWORDS)) {
      hasFish = true;
    }
    if (containsKeyword(ingredient, ANIMAL_PRODUCT_KEYWORDS)) {
      hasAnimalProducts = true;
    }
  }

  // Vegan: no meat, no fish, no animal products
  if (!hasMeat && !hasFish && !hasAnimalProducts) {
    dietary.push('vegan');
    dietary.push('vegetarian'); // Vegan is also vegetarian
  }
  // Vegetarian: no meat, no fish (but may have eggs/dairy)
  else if (!hasMeat && !hasFish) {
    dietary.push('vegetarian');
  }
  // Pescatarian: no meat (but may have fish)
  else if (!hasMeat && hasFish) {
    dietary.push('pescatarian');
  }

  return dietary;
}

/**
 * Combined detection of both allergens and dietary classifications
 */
export interface DetectionResult {
  allergens: AllergenType[];
  dietary: DietaryType[];
}

export function detectAllCategories(ingredients: string[]): DetectionResult {
  return {
    allergens: detectAllergens(ingredients),
    dietary: detectDietary(ingredients),
  };
}
