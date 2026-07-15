import * as cheerio from 'cheerio';
import he from 'he';
import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

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

      // Check if it's directly a Recipe (@type may be a string or an array)
      const type = data['@type'];
      if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
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
 * Classify a dotted-decimal IPv4 address (given as four octets) as private/reserved.
 */
function isPrivateOrReservedIpv4(a: number, b: number, c: number, d: number): boolean {
  return (
    a === 0 ||                                            // 0.0.0.0/8 ("this network" / unspecified)
    a === 10 ||                                           // 10.0.0.0/8 (private)
    a === 127 ||                                          // 127.0.0.0/8 (loopback)
    (a === 100 && b >= 64 && b <= 127) ||                 // 100.64.0.0/10 (CGNAT)
    (a === 169 && b === 254) ||                           // 169.254.0.0/16 (link-local)
    (a === 172 && b >= 16 && b <= 31) ||                  // 172.16.0.0/12 (private)
    (a === 192 && b === 168) ||                           // 192.168.0.0/16 (private)
    (a === 255 && b === 255 && c === 255 && d === 255)    // 255.255.255.255 (broadcast)
  );
}

/**
 * Expand an IPv6 address string into its eight 16-bit hextets.
 * Handles "::" compression and a trailing embedded dotted-decimal IPv4
 * (e.g. "::ffff:127.0.0.1"). Returns null if the input is not a parseable IPv6.
 */
function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase();

  // Convert a trailing embedded IPv4 (dotted-decimal) into two hextets.
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':');
    const v4 = s.slice(lastColon + 1);
    if (isIP(v4) !== 4) return null;
    const [a, b, c, d] = v4.split('.').map(Number);
    const hi = ((a << 8) | b).toString(16);
    const lo = ((c << 8) | d).toString(16);
    s = s.slice(0, lastColon + 1) + hi + ':' + lo;
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];

  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    groups = head;
  }

  if (groups.length !== 8) return null;
  return groups.map((g) => parseInt(g || '0', 16));
}

/**
 * Classify an IPv6 address string as private/reserved. Covers loopback (::1),
 * unspecified (::), link-local (fe80::/10), unique-local (fc00::/7), and
 * IPv4-mapped addresses (::ffff:a.b.c.d) whose embedded IPv4 is private/reserved.
 */
function isPrivateOrReservedIpv6(ip: string): boolean {
  const h = expandIpv6(ip);
  if (!h) return false;

  // Unspecified ::
  if (h.every((x) => x === 0)) return true;
  // Loopback ::1
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true;
  // IPv4-mapped ::ffff:a.b.c.d -> classify the embedded IPv4
  if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0xffff) {
    const a = (h[6] >> 8) & 0xff;
    const b = h[6] & 0xff;
    const c = (h[7] >> 8) & 0xff;
    const d = h[7] & 0xff;
    return isPrivateOrReservedIpv4(a, b, c, d);
  }
  // Link-local fe80::/10 (fe80 - febf)
  if (h[0] >= 0xfe80 && h[0] <= 0xfebf) return true;
  // Unique-local fc00::/7 (fc00 - fdff)
  if (h[0] >= 0xfc00 && h[0] <= 0xfdff) return true;

  return false;
}

/**
 * Returns true if the given IP literal (IPv4 or IPv6) falls in a private,
 * loopback, link-local, CGNAT, unique-local, or otherwise reserved range.
 * Returns false for anything that is not a valid IP literal.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const [a, b, c, d] = ip.split('.').map(Number);
    return isPrivateOrReservedIpv4(a, b, c, d);
  }
  if (family === 6) {
    return isPrivateOrReservedIpv6(ip);
  }
  return false;
}

/** DNS resolver signature, kept injectable so tests can stub resolution. */
export type LookupFn = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

/** Default resolver: resolve every A/AAAA record for the host. */
const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true });

/**
 * Assert that a URL is safe to fetch: it must use http(s) and must not resolve
 * to a private/reserved IP. IP-literal hosts are classified directly; DNS names
 * are resolved (resolver injectable for tests) and rejected if ANY resolved
 * address is private/reserved. Prevents SSRF against cloud metadata endpoints,
 * RFC1918 hosts, and DNS names that point at internal addresses.
 *
 * NOTE: this validates-then-fetches. A residual TOCTOU / DNS-rebinding window
 * remains because the connection may resolve the host again to a different IP;
 * fully closing it requires connection-level IP pinning, which is out of scope.
 */
export async function assertUrlSafe(url: URL | string, lookupFn: LookupFn = defaultLookup): Promise<void> {
  const parsed = typeof url === 'string' ? new URL(url) : url;

  // Only allow http and https protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }

  // Strip IPv6 brackets that URL.hostname preserves (e.g. "[::1]").
  const host = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '');

  // IP literal: classify directly (covers int/hex/octal IPv4 normalized by URL).
  if (isIP(host) !== 0) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('URLs pointing to private/reserved IP addresses are not allowed');
    }
    return;
  }

  // DNS name: resolve and reject if ANY address is private/reserved. This also
  // catches "localhost" (resolves to loopback) and DNS-rebinding setups.
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookupFn(host);
  } catch {
    throw new Error(`Unable to resolve host: ${host}`);
  }
  if (!addresses || addresses.length === 0) {
    throw new Error(`Unable to resolve host: ${host}`);
  }
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error('URLs pointing to private/reserved IP addresses are not allowed');
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

/** Maximum number of redirect hops to follow (each hop is re-validated). */
const MAX_REDIRECTS = 5;

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

  // Fetch the page with timeout and size limit. Redirects are followed manually
  // so that EVERY hop is re-validated for SSRF (a public URL can 302 to an
  // internal address such as the cloud metadata endpoint).
  let currentUrl = parsedUrl;
  let redirectCount = 0;
  let response: Response;
  while (true) {
    // SSRF protection: validate protocol and resolve host on every hop.
    await assertUrlSafe(currentUrl);

    response = await fetch(currentUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'manual',
    });

    // Handle 3xx redirects ourselves so the target is re-validated before fetch.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        if (redirectCount >= MAX_REDIRECTS) {
          throw new Error('Too many redirects while fetching URL');
        }
        redirectCount++;
        currentUrl = new URL(location, currentUrl);
        continue;
      }
    }
    break;
  }

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

  // Extract image: try structured data first, fallback to og:image.
  // Resolve relative / protocol-relative URLs against the fetched page URL
  // BEFORE validating, then reject anything that isn't http(s).
  const rawImage = extractImage(recipeData.image) || extractOgImage(html);
  let image: string | undefined;
  if (rawImage) {
    try {
      const resolved = new URL(rawImage, currentUrl).href;
      if (isValidImageUrl(resolved)) image = resolved;
    } catch {
      image = undefined;
    }
  }

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
