import * as cheerio from 'cheerio';
import he from 'he';

/**
 * Scraped recipe data from a URL
 */
export interface ScrapedRecipe {
  name: string;
  description?: string;
  prepTime?: string; // ISO 8601 duration (e.g., "PT30M")
  cookTime?: string;
  totalTime?: string;
  servings?: number;
  ingredients: string[];
  instructions: string[];
  image?: string; // Recipe image URL (from structured data or og:image)
  sourceUrl: string;
}

/**
 * Parse ISO 8601 duration to minutes
 * Examples: "PT30M" -> 30, "PT1H30M" -> 90, "PT2H" -> 120
 */
export function parseDuration(duration: string | undefined | null): number | null {
  if (!duration) return null;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return null;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 60 + minutes + Math.round(seconds / 60);
}

/**
 * Extract yield/servings from various formats
 * Examples: "4 servings", "Serves 6", "4", "4-6 servings"
 */
function parseServings(yield_: string | number | undefined | null): number | null {
  if (!yield_) return null;

  if (typeof yield_ === 'number') return yield_;

  const str = String(yield_);
  // Try to extract first number
  const match = str.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Clean instruction text - remove HTML tags, decode entities, normalize whitespace
 */
function cleanText(text: string): string {
  return he.decode(text)
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Extract instructions from various formats
 */
function extractInstructions(instructions: unknown): string[] {
  if (!instructions) return [];

  // If it's an array
  if (Array.isArray(instructions)) {
    return instructions.flatMap((item): string[] => {
      if (typeof item === 'string') {
        return [cleanText(item)];
      }
      // HowToStep or HowToSection
      if (item && typeof item === 'object') {
        if (item.text) {
          return [cleanText(item.text)];
        }
        if (item.itemListElement) {
          return extractInstructions(item.itemListElement);
        }
      }
      return [];
    }).filter(Boolean);
  }

  // If it's a string
  if (typeof instructions === 'string') {
    // Split by newlines or numbered steps
    const steps = instructions
      .split(/\n|(?:\d+\.\s)/)
      .map(s => cleanText(s))
      .filter(s => s.length > 10); // Filter out very short fragments

    return steps.length > 0 ? steps : [cleanText(instructions)];
  }

  // If it's a single object with text
  if (instructions && typeof instructions === 'object' && 'text' in instructions) {
    return [cleanText((instructions as { text: string }).text)];
  }

  return [];
}

/**
 * Extract ingredients from various formats
 */
function extractIngredients(ingredients: unknown): string[] {
  if (!ingredients) return [];

  if (Array.isArray(ingredients)) {
    return ingredients
      .map((item): string => {
        if (typeof item === 'string') return cleanText(item);
        if (item && typeof item === 'object' && 'name' in item) {
          return cleanText(String(item.name));
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof ingredients === 'string') {
    return ingredients.split('\n').map(s => cleanText(s)).filter(Boolean);
  }

  return [];
}

/**
 * Extract image URL from various formats in recipe structured data
 * Handles: string URL, array of URLs, ImageObject, array of ImageObjects
 */
function extractImage(image: unknown): string | undefined {
  if (!image) return undefined;

  if (typeof image === 'string') return image;

  if (Array.isArray(image)) {
    // Use the first image
    const first = image[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first) {
      return String((first as { url: string }).url);
    }
    return undefined;
  }

  if (typeof image === 'object' && 'url' in image) {
    return String((image as { url: string }).url);
  }

  return undefined;
}

/**
 * Extract og:image from HTML meta tags as fallback
 */
function extractOgImage(html: string): string | undefined {
  const $ = cheerio.load(html);
  const ogImage = $('meta[property="og:image"]').attr('content');
  return ogImage || undefined;
}

/**
 * Find and parse JSON-LD Recipe schema from HTML
 */
function findJsonLdRecipe(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);

  // Find all JSON-LD script tags
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const content = $(scripts[i]).html();
      if (!content) continue;

      const data = JSON.parse(content);

      // Check if it's directly a Recipe
      if (data['@type'] === 'Recipe') {
        return data;
      }

      // Check if it's wrapped in @graph
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        const recipe = data['@graph'].find(
          (item: { '@type'?: string | string[] }) =>
            item['@type'] === 'Recipe' ||
            (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        if (recipe) return recipe;
      }

      // Check if it's an array of schemas
      if (Array.isArray(data)) {
        const recipe = data.find(
          (item: { '@type'?: string | string[] }) =>
            item['@type'] === 'Recipe' ||
            (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        if (recipe) return recipe;
      }
    } catch {
      // Invalid JSON, continue to next script tag
      continue;
    }
  }

  return null;
}

/**
 * Fallback: Try to extract recipe data from microdata
 */
function findMicrodataRecipe(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);

  const recipeElement = $('[itemtype*="schema.org/Recipe"]');
  if (recipeElement.length === 0) return null;

  const recipe: Record<string, unknown> = {};

  // Extract common properties
  const name = recipeElement.find('[itemprop="name"]').first().text();
  if (name) recipe.name = cleanText(name);

  const description = recipeElement.find('[itemprop="description"]').first().text();
  if (description) recipe.description = cleanText(description);

  const prepTime = recipeElement.find('[itemprop="prepTime"]').first().attr('datetime') ||
    recipeElement.find('[itemprop="prepTime"]').first().attr('content');
  if (prepTime) recipe.prepTime = prepTime;

  const cookTime = recipeElement.find('[itemprop="cookTime"]').first().attr('datetime') ||
    recipeElement.find('[itemprop="cookTime"]').first().attr('content');
  if (cookTime) recipe.cookTime = cookTime;

  const yield_ = recipeElement.find('[itemprop="recipeYield"]').first().text();
  if (yield_) recipe.recipeYield = cleanText(yield_);

  // Get image
  const imageEl = recipeElement.find('[itemprop="image"]').first();
  const imageSrc = imageEl.attr('src') || imageEl.attr('content');
  if (imageSrc) recipe.image = imageSrc;

  // Get ingredients
  const ingredients: string[] = [];
  recipeElement.find('[itemprop="recipeIngredient"], [itemprop="ingredients"]').each((_, el) => {
    const text = $(el).text();
    if (text) ingredients.push(cleanText(text));
  });
  if (ingredients.length > 0) recipe.recipeIngredient = ingredients;

  // Get instructions
  const instructions: string[] = [];
  recipeElement.find('[itemprop="recipeInstructions"]').each((_, el) => {
    const text = $(el).text();
    if (text) instructions.push(cleanText(text));
  });
  if (instructions.length > 0) recipe.recipeInstructions = instructions;

  return Object.keys(recipe).length > 0 ? recipe : null;
}

/**
 * Validate that a URL uses an allowed protocol and does not point to a private/reserved IP range.
 * Prevents SSRF attacks when fetching user-provided URLs.
 */
function validateUrlSafety(parsedUrl: URL): void {
  // Only allow http and https protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }

  const hostname = parsedUrl.hostname;

  // Block localhost and loopback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('URLs pointing to localhost are not allowed');
  }

  // Block private/reserved IPv4 ranges
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 10 ||                           // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||  // 172.16.0.0/12
      (a === 192 && b === 168) ||           // 192.168.0.0/16
      (a === 169 && b === 254) ||           // 169.254.0.0/16 (link-local)
      a === 0                                // 0.0.0.0/8
    ) {
      throw new Error('URLs pointing to private/reserved IP ranges are not allowed');
    }
  }
}

/**
 * Validate that an image URL uses a safe protocol (http or https).
 * Rejects javascript:, data:, and relative URLs.
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Maximum response body size for recipe scraping (5MB) */
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

/** Fetch timeout in milliseconds (10 seconds) */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Scrape a recipe from a URL
 */
export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL provided');
  }

  // SSRF protection: validate protocol and block private IPs
  validateUrlSafety(parsedUrl);

  // Fetch the page with timeout and size limit
  const response = await fetch(parsedUrl.href, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  // Check Content-Length if available
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
    throw new Error('Response too large (exceeds 5MB limit)');
  }

  // Read body with size limit via streaming
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Unable to read response body');
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.byteLength;
    if (totalSize > MAX_RESPONSE_SIZE) {
      reader.cancel();
      throw new Error('Response too large (exceeds 5MB limit)');
    }
    chunks.push(value);
  }
  const html = new TextDecoder().decode(Buffer.concat(chunks));

  // Try JSON-LD first (most reliable)
  let recipeData = findJsonLdRecipe(html);

  // Fallback to microdata
  if (!recipeData) {
    recipeData = findMicrodataRecipe(html);
  }

  if (!recipeData) {
    throw new Error('No recipe data found on this page. The site may not use structured data.');
  }

  // Extract and validate required fields
  const name = recipeData.name;
  if (!name || typeof name !== 'string') {
    throw new Error('Recipe name not found');
  }

  const ingredients = extractIngredients(recipeData.recipeIngredient);
  if (ingredients.length === 0) {
    throw new Error('No ingredients found in recipe');
  }

  const instructions = extractInstructions(recipeData.recipeInstructions);
  if (instructions.length === 0) {
    throw new Error('No instructions found in recipe');
  }

  // Extract image: try structured data first, fallback to og:image
  // Validate image URL protocol (reject javascript:, data:, relative paths)
  const rawImage = extractImage(recipeData.image) || extractOgImage(html);
  const image = rawImage && isValidImageUrl(rawImage) ? rawImage : undefined;

  return {
    name: cleanText(name),
    description: recipeData.description ? cleanText(String(recipeData.description)) : undefined,
    prepTime: recipeData.prepTime as string | undefined,
    cookTime: recipeData.cookTime as string | undefined,
    totalTime: recipeData.totalTime as string | undefined,
    servings: parseServings(recipeData.recipeYield as string | number | undefined) ?? undefined,
    ingredients,
    instructions,
    image,
    sourceUrl: url,
  };
}
