/**
 * Shopping list category taxonomy and keyword-based auto-categorization.
 *
 * The slug list mirrors `frontend/src/lib/categories.ts` (minus the `default`
 * pseudo-slug, which means "uncategorized"). If a slug is added there it must
 * be added here too — the MCP tool schema and the keyword guesser both build
 * on this list.
 */

import { normalizeItemName } from './itemMatcher.js';

export const SHOPPING_CATEGORY_SLUGS = [
  'fruitveg',
  'dairy',
  'meat',
  'fish',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'household',
  'toiletries',
  'medicine',
  'other',
] as const;

export type ShoppingCategorySlug = (typeof SHOPPING_CATEGORY_SLUGS)[number];

/** Friendly names, used in MCP tool descriptions so the model knows the grouping. */
export const SHOPPING_CATEGORY_NAMES: Record<ShoppingCategorySlug, string> = {
  fruitveg: 'Fruit & Veg',
  dairy: 'Dairy',
  meat: 'Meat',
  fish: 'Fish',
  bakery: 'Bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  beverages: 'Beverages',
  household: 'Household',
  toiletries: 'Toiletries',
  medicine: 'Medicine',
  other: 'Other',
};

/**
 * Keyword -> category dictionary. Keys are written in natural form and
 * normalized (lowercased, singularized per word) at module load, so plural
 * inputs match. Multi-word keys are matched as whole phrases before any
 * single-word match; single words are matched last-word-first, so
 * "cheddar cheese" hits `cheese` (dairy) and "milk chocolate" hits
 * `chocolate` (pantry) rather than `milk`.
 */
const KEYWORDS: Record<string, ShoppingCategorySlug> = {
  // --- fruit & veg -------------------------------------------------------
  apple: 'fruitveg', banana: 'fruitveg', orange: 'fruitveg', lemon: 'fruitveg',
  lime: 'fruitveg', grape: 'fruitveg', grapefruit: 'fruitveg',
  strawberries: 'fruitveg', strawberry: 'fruitveg', blueberries: 'fruitveg',
  raspberries: 'fruitveg', blackberries: 'fruitveg', cherries: 'fruitveg',
  cherry: 'fruitveg', berry: 'fruitveg', berries: 'fruitveg',
  peach: 'fruitveg', pear: 'fruitveg', plum: 'fruitveg', pineapple: 'fruitveg',
  mango: 'fruitveg', melon: 'fruitveg', watermelon: 'fruitveg', kiwi: 'fruitveg',
  avocado: 'fruitveg', nectarine: 'fruitveg', apricot: 'fruitveg',
  satsuma: 'fruitveg', clementine: 'fruitveg', tangerine: 'fruitveg',
  pomegranate: 'fruitveg', fig: 'fruitveg', rhubarb: 'fruitveg',
  tomato: 'fruitveg', potato: 'fruitveg', carrot: 'fruitveg', onion: 'fruitveg',
  garlic: 'fruitveg', ginger: 'fruitveg', broccoli: 'fruitveg',
  cauliflower: 'fruitveg', cabbage: 'fruitveg', lettuce: 'fruitveg',
  spinach: 'fruitveg', kale: 'fruitveg', rocket: 'fruitveg', celery: 'fruitveg',
  cucumber: 'fruitveg', courgette: 'fruitveg', zucchini: 'fruitveg',
  aubergine: 'fruitveg', eggplant: 'fruitveg', pepper: 'fruitveg',
  chilli: 'fruitveg', chili: 'fruitveg', mushroom: 'fruitveg', leek: 'fruitveg',
  parsnip: 'fruitveg', turnip: 'fruitveg', swede: 'fruitveg',
  beetroot: 'fruitveg', radish: 'fruitveg', squash: 'fruitveg',
  pumpkin: 'fruitveg', sweetcorn: 'fruitveg', corn: 'fruitveg', pea: 'fruitveg',
  asparagus: 'fruitveg', artichoke: 'fruitveg', shallot: 'fruitveg',
  salad: 'fruitveg', herb: 'fruitveg', coriander: 'fruitveg',
  parsley: 'fruitveg', basil: 'fruitveg', mint: 'fruitveg', dill: 'fruitveg',
  chive: 'fruitveg', lemongrass: 'fruitveg', 'green bean': 'fruitveg',
  'runner bean': 'fruitveg', 'sweet potato': 'fruitveg',
  'butternut squash': 'fruitveg', 'spring onion': 'fruitveg',

  // --- dairy (incl. chilled dairy alternatives and eggs) -----------------
  milk: 'dairy', cheese: 'dairy', cheddar: 'dairy', mozzarella: 'dairy',
  parmesan: 'dairy', feta: 'dairy', brie: 'dairy', halloumi: 'dairy',
  gouda: 'dairy', stilton: 'dairy', yogurt: 'dairy', yoghurt: 'dairy',
  butter: 'dairy', margarine: 'dairy', cream: 'dairy', custard: 'dairy',
  egg: 'dairy', buttermilk: 'dairy', kefir: 'dairy', quark: 'dairy',
  'creme fraiche': 'dairy', 'oat milk': 'dairy', 'almond milk': 'dairy',
  'soy milk': 'dairy', 'soya milk': 'dairy',

  // --- meat --------------------------------------------------------------
  chicken: 'meat', beef: 'meat', pork: 'meat', lamb: 'meat', turkey: 'meat',
  duck: 'meat', bacon: 'meat', sausage: 'meat', ham: 'meat', mince: 'meat',
  steak: 'meat', chorizo: 'meat', salami: 'meat', pepperoni: 'meat',
  prosciutto: 'meat', meatball: 'meat', burger: 'meat', gammon: 'meat',
  venison: 'meat', liver: 'meat', pancetta: 'meat', frankfurter: 'meat',
  'hot dog': 'meat',

  // --- fish --------------------------------------------------------------
  fish: 'fish', salmon: 'fish', tuna: 'fish', cod: 'fish', haddock: 'fish',
  prawn: 'fish', shrimp: 'fish', mackerel: 'fish', sardine: 'fish',
  anchovies: 'fish', anchovy: 'fish', trout: 'fish', halibut: 'fish',
  plaice: 'fish', crab: 'fish', lobster: 'fish', mussel: 'fish',
  oyster: 'fish', squid: 'fish', calamari: 'fish', scallop: 'fish',
  kipper: 'fish', 'sea bass': 'fish', seabass: 'fish',

  // --- bakery ------------------------------------------------------------
  bread: 'bakery', baguette: 'bakery', roll: 'bakery', bagel: 'bakery',
  croissant: 'bakery', muffin: 'bakery', bun: 'bakery', brioche: 'bakery',
  pitta: 'bakery', pita: 'bakery', naan: 'bakery', tortilla: 'bakery',
  wrap: 'bakery', crumpet: 'bakery', scone: 'bakery', cake: 'bakery',
  doughnut: 'bakery', donut: 'bakery', pastries: 'bakery', pastry: 'bakery',
  loaf: 'bakery', loaves: 'bakery', sourdough: 'bakery', ciabatta: 'bakery',
  focaccia: 'bakery', brownie: 'bakery',

  // --- pantry ------------------------------------------------------------
  pasta: 'pantry', spaghetti: 'pantry', penne: 'pantry', fusilli: 'pantry',
  macaroni: 'pantry', lasagne: 'pantry', noodle: 'pantry', rice: 'pantry',
  flour: 'pantry', sugar: 'pantry', salt: 'pantry', oil: 'pantry',
  vinegar: 'pantry', sauce: 'pantry', ketchup: 'pantry', mayonnaise: 'pantry',
  mayo: 'pantry', mustard: 'pantry', jam: 'pantry', honey: 'pantry',
  marmalade: 'pantry', cereal: 'pantry', oat: 'pantry', granola: 'pantry',
  muesli: 'pantry', porridge: 'pantry', biscuit: 'pantry', cracker: 'pantry',
  crisp: 'pantry', snack: 'pantry', chocolate: 'pantry', sweets: 'pantry',
  candies: 'pantry', candy: 'pantry', nut: 'pantry', almond: 'pantry',
  cashew: 'pantry', peanut: 'pantry', walnut: 'pantry', pistachio: 'pantry',
  raisin: 'pantry', sultana: 'pantry', lentil: 'pantry', chickpea: 'pantry',
  bean: 'pantry', stock: 'pantry', spice: 'pantry', cumin: 'pantry',
  paprika: 'pantry', turmeric: 'pantry', cinnamon: 'pantry', nutmeg: 'pantry',
  oregano: 'pantry', soup: 'pantry', syrup: 'pantry', yeast: 'pantry',
  vanilla: 'pantry', cocoa: 'pantry', gravy: 'pantry', passata: 'pantry',
  puree: 'pantry', pesto: 'pantry', quinoa: 'pantry', couscous: 'pantry',
  popcorn: 'pantry', pretzel: 'pantry', sweetener: 'pantry', seed: 'pantry',
  'peanut butter': 'pantry', 'coconut milk': 'pantry', 'baked bean': 'pantry',
  'kidney bean': 'pantry', 'baking powder': 'pantry', 'baking soda': 'pantry',
  'bicarbonate of soda': 'pantry', 'black pepper': 'pantry',
  'white pepper': 'pantry', 'cayenne pepper': 'pantry',
  'chopped tomato': 'pantry', 'plum tomato': 'pantry', 'curry powder': 'pantry',
  'curry paste': 'pantry', 'stock cube': 'pantry', 'soy sauce': 'pantry',
  'olive oil': 'pantry', 'tomato puree': 'pantry',

  // --- frozen ------------------------------------------------------------
  sorbet: 'frozen', lolly: 'frozen', lollies: 'frozen', pizza: 'frozen',
  'ice cream': 'frozen', 'fish finger': 'frozen', 'ice cube': 'frozen',

  // --- beverages ---------------------------------------------------------
  water: 'beverages', juice: 'beverages', coffee: 'beverages', tea: 'beverages',
  beer: 'beverages', lager: 'beverages', ale: 'beverages', wine: 'beverages',
  prosecco: 'beverages', champagne: 'beverages', cider: 'beverages',
  gin: 'beverages', vodka: 'beverages', whisky: 'beverages',
  whiskey: 'beverages', rum: 'beverages', cola: 'beverages',
  lemonade: 'beverages', soda: 'beverages', smoothie: 'beverages',
  cordial: 'beverages', milkshake: 'beverages', drink: 'beverages',
  kombucha: 'beverages', 'orange squash': 'beverages',

  // --- household ---------------------------------------------------------
  detergent: 'household', bleach: 'household', cleaner: 'household',
  sponge: 'household', cloth: 'household', foil: 'household',
  clingfilm: 'household', parchment: 'household', tissue: 'household',
  napkin: 'household', candle: 'household', batteries: 'household',
  battery: 'household', lightbulb: 'household', match: 'household',
  matches: 'household', laundry: 'household', softener: 'household',
  freshener: 'household', polish: 'household', wipe: 'household',
  'washing up liquid': 'household', 'washing powder': 'household',
  'washing liquid': 'household', 'bin bag': 'household',
  'bin liner': 'household', 'cling film': 'household',
  'kitchen roll': 'household', 'toilet roll': 'household',
  'loo roll': 'household', 'toilet paper': 'household',
  'light bulb': 'household', 'dishwasher tablet': 'household',
  'fairy liquid': 'household',

  // --- toiletries --------------------------------------------------------
  shampoo: 'toiletries', conditioner: 'toiletries', toothpaste: 'toiletries',
  toothbrush: 'toiletries', deodorant: 'toiletries', soap: 'toiletries',
  moisturiser: 'toiletries', moisturizer: 'toiletries', lotion: 'toiletries',
  razor: 'toiletries', floss: 'toiletries', mouthwash: 'toiletries',
  sunscreen: 'toiletries', suncream: 'toiletries', perfume: 'toiletries',
  aftershave: 'toiletries', tampon: 'toiletries', nappy: 'toiletries',
  nappies: 'toiletries', 'shower gel': 'toiletries',
  'shaving cream': 'toiletries', 'shaving foam': 'toiletries',
  'cotton wool': 'toiletries', 'hand wash': 'toiletries',
  'bubble bath': 'toiletries', 'sanitary towel': 'toiletries',

  // --- medicine ----------------------------------------------------------
  paracetamol: 'medicine', ibuprofen: 'medicine', aspirin: 'medicine',
  plaster: 'medicine', bandage: 'medicine', vitamin: 'medicine',
  medicine: 'medicine', tablet: 'medicine', capsule: 'medicine',
  antiseptic: 'medicine', lozenge: 'medicine', antihistamine: 'medicine',
  calpol: 'medicine', 'cough syrup': 'medicine', 'cough medicine': 'medicine',
};

// Build normalized lookup structures once at module load. Keys are passed
// through the same normalizeItemName used on inputs, so plural/singular
// spellings of a key collapse to the same entry as plural/singular inputs.
const WORD_LOOKUP = new Map<string, ShoppingCategorySlug>();
const PHRASE_LOOKUP: Array<[string, ShoppingCategorySlug]> = [];

for (const [key, slug] of Object.entries(KEYWORDS)) {
  const normalized = normalizeItemName(key);
  if (normalized.includes(' ')) {
    PHRASE_LOOKUP.push([normalized, slug]);
  } else {
    WORD_LOOKUP.set(normalized, slug);
  }
}
// Longer phrases first so "bicarbonate of soda" wins over any shorter overlap.
PHRASE_LOOKUP.sort((a, b) => b[0].length - a[0].length);

/**
 * Guess a category slug from an item name, or null if nothing matches.
 *
 * Match order:
 * 1. "frozen" / "tinned" / "canned" anywhere in the name (aisle overrides)
 * 2. the whole normalized name as a dictionary key
 * 3. multi-word phrases (longest first, whole-word boundaries)
 * 4. single words, scanned last-to-first (the head noun usually comes last:
 *    "cheddar cheese" -> cheese, "chicken stock" -> stock)
 */
export function guessCategory(name: string): ShoppingCategorySlug | null {
  const normalized = normalizeItemName(name);
  if (!normalized) return null;

  const words = normalized.split(' ');

  if (words.includes('frozen')) return 'frozen';
  if (words.includes('tinned') || words.includes('canned')) return 'pantry';

  const exact = WORD_LOOKUP.get(normalized);
  if (exact) return exact;

  const padded = ` ${normalized} `;
  for (const [phrase, slug] of PHRASE_LOOKUP) {
    if (padded.includes(` ${phrase} `)) return slug;
  }

  for (let i = words.length - 1; i >= 0; i--) {
    const slug = WORD_LOOKUP.get(words[i]);
    if (slug) return slug;
  }

  return null;
}
