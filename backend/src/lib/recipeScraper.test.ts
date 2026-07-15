import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseDuration,
  scrapeRecipe,
  isPrivateOrReservedIp,
  assertUrlSafe,
  type LookupFn,
} from './recipeScraper';

/**
 * Creates a mock fetch Response with headers and a streaming body,
 * matching the properties accessed by the production scrapeRecipe code.
 */
function mockFetchResponse(html: string) {
  const encoded = new TextEncoder().encode(html);
  return {
    ok: true,
    headers: new Headers(),
    body: {
      getReader: () => {
        let read = false;
        return {
          read: async () => {
            if (read) return { done: true, value: undefined };
            read = true;
            return { done: false, value: encoded };
          },
          cancel: async () => {},
        };
      },
    },
  };
}

describe('parseDuration', () => {
  it('parses minutes only (PT30M)', () => {
    expect(parseDuration('PT30M')).toBe(30);
  });

  it('parses hours only (PT2H)', () => {
    expect(parseDuration('PT2H')).toBe(120);
  });

  it('parses hours and minutes (PT1H30M)', () => {
    expect(parseDuration('PT1H30M')).toBe(90);
  });

  it('parses hours, minutes and seconds (PT1H15M30S)', () => {
    expect(parseDuration('PT1H15M30S')).toBe(76);
  });

  it('parses seconds only (PT90S)', () => {
    expect(parseDuration('PT90S')).toBe(2);
  });

  it('returns null for null input', () => {
    expect(parseDuration(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseDuration(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDuration('')).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(parseDuration('30 minutes')).toBeNull();
  });

  it('is case insensitive', () => {
    expect(parseDuration('pt45m')).toBe(45);
  });
});

describe('scrapeRecipe', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws on invalid URL', async () => {
    await expect(scrapeRecipe('not-a-url')).rejects.toThrow('Invalid URL provided');
  });

  it('throws on failed HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    await expect(scrapeRecipe('https://example.com/recipe')).rejects.toThrow(
      'Failed to fetch URL: 404 Not Found'
    );
  });

  it('throws when no recipe data found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockFetchResponse('<html><body>No recipe here</body></html>')
    ));

    await expect(scrapeRecipe('https://example.com/page')).rejects.toThrow(
      'No recipe data found on this page'
    );
  });

  it('parses JSON-LD Recipe schema', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Test Pasta",
          "description": "A simple pasta recipe",
          "prepTime": "PT15M",
          "cookTime": "PT30M",
          "recipeYield": "4 servings",
          "recipeIngredient": [
            "200g pasta",
            "2 cups tomato sauce",
            "1 tbsp olive oil"
          ],
          "recipeInstructions": [
            "Boil the pasta according to package directions.",
            "Heat sauce in a pan.",
            "Combine pasta and sauce."
          ]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.name).toBe('Test Pasta');
    expect(recipe.description).toBe('A simple pasta recipe');
    expect(recipe.prepTime).toBe('PT15M');
    expect(recipe.cookTime).toBe('PT30M');
    expect(recipe.servings).toBe(4);
    expect(recipe.ingredients).toHaveLength(3);
    expect(recipe.ingredients[0]).toBe('200g pasta');
    expect(recipe.instructions).toHaveLength(3);
    expect(recipe.sourceUrl).toBe('https://example.com/recipe');
  });

  it('parses JSON-LD wrapped in @graph', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@graph": [
            { "@type": "WebPage", "name": "My Blog" },
            {
              "@type": "Recipe",
              "name": "Graph Soup",
              "recipeIngredient": ["water", "salt"],
              "recipeInstructions": ["Boil water and add salt to taste"]
            }
          ]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.name).toBe('Graph Soup');
    expect(recipe.ingredients).toEqual(['water', 'salt']);
  });

  it('parses HowToStep instructions', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Step Recipe",
          "recipeIngredient": ["1 cup flour"],
          "recipeInstructions": [
            { "@type": "HowToStep", "text": "Mix the flour." },
            { "@type": "HowToStep", "text": "Bake at 350F." }
          ]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.instructions).toEqual(['Mix the flour.', 'Bake at 350F.']);
  });

  it('throws when recipe name is missing', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "recipeIngredient": ["1 cup flour"],
          "recipeInstructions": ["Mix it"]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    await expect(scrapeRecipe('https://example.com/recipe')).rejects.toThrow(
      'Recipe name not found'
    );
  });

  it('throws when no ingredients found', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Empty Recipe",
          "recipeIngredient": [],
          "recipeInstructions": ["Do something"]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    await expect(scrapeRecipe('https://example.com/recipe')).rejects.toThrow(
      'No ingredients found in recipe'
    );
  });

  it('cleans HTML entities from text', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Chef&apos;s Special",
          "recipeIngredient": ["1 cup flour &amp; sugar"],
          "recipeInstructions": ["Mix the flour &amp; sugar together."]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.name).toBe("Chef's Special");
    expect(recipe.ingredients[0]).toBe('1 cup flour & sugar');
  });

  it('parses numeric recipeYield (parseServings with number)', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Numeric Yield Recipe",
          "recipeYield": 6,
          "recipeIngredient": ["1 cup rice"],
          "recipeInstructions": ["Cook the rice until tender."]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.servings).toBe(6);
  });

  it('parses string-type recipeInstructions (splits by newlines)', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "String Instructions Recipe",
          "recipeIngredient": ["2 eggs", "1 cup milk"],
          "recipeInstructions": "Crack the eggs into a bowl and whisk them well.\\nPour in the milk and stir until combined.\\nCook on medium heat until set."
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.instructions).toHaveLength(3);
    expect(recipe.instructions[0]).toContain('Crack the eggs');
  });

  it('extracts ingredients with name property (object format)', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Object Ingredients Recipe",
          "recipeIngredient": [
            { "name": "2 cups flour" },
            { "name": "1 tsp baking powder" }
          ],
          "recipeInstructions": ["Mix dry ingredients together thoroughly."]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.ingredients).toEqual(['2 cups flour', '1 tsp baking powder']);
  });

  it('parses array-of-schemas JSON-LD format', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        [
          { "@type": "WebSite", "name": "My Cooking Blog" },
          {
            "@type": "Recipe",
            "name": "Array Schema Cake",
            "recipeIngredient": ["3 cups flour", "2 cups sugar"],
            "recipeInstructions": ["Mix all ingredients and bake at 350F for thirty minutes."]
          }
        ]
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.name).toBe('Array Schema Cake');
    expect(recipe.ingredients).toEqual(['3 cups flour', '2 cups sugar']);
  });

  it('extracts totalTime from recipe data', async () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Timed Recipe",
          "prepTime": "PT10M",
          "cookTime": "PT20M",
          "totalTime": "PT30M",
          "recipeIngredient": ["1 cup flour"],
          "recipeInstructions": ["Mix everything together and bake until done."]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.totalTime).toBe('PT30M');
    expect(recipe.prepTime).toBe('PT10M');
    expect(recipe.cookTime).toBe('PT20M');
  });

  it('throws on fetch network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(scrapeRecipe('https://example.com/recipe')).rejects.toThrow('Network error');
  });

  it('parses microdata fallback', async () => {
    const html = `
      <html>
      <body>
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">Microdata Soup</h1>
          <p itemprop="description">A warm soup</p>
          <span itemprop="recipeIngredient">2 cups water</span>
          <span itemprop="recipeIngredient">1 tsp salt</span>
          <div itemprop="recipeInstructions">Boil the water and add salt to the pot.</div>
        </div>
      </body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(html)));

    const recipe = await scrapeRecipe('https://example.com/recipe');
    expect(recipe.name).toBe('Microdata Soup');
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.instructions.length).toBeGreaterThan(0);
  });
});

describe('isPrivateOrReservedIp', () => {
  const blocked: Array<[string, string]> = [
    ['127.0.0.1', 'loopback (literal blocked before)'],
    ['127.0.0.5', 'rest of 127.0.0.0/8'],
    ['10.0.0.1', '10.0.0.0/8 private'],
    ['172.16.0.1', '172.16.0.0/12 lower bound'],
    ['172.31.255.255', '172.16.0.0/12 upper bound'],
    ['192.168.1.1', '192.168.0.0/16 private'],
    ['169.254.169.254', 'link-local / cloud metadata'],
    ['100.64.0.1', 'CGNAT 100.64.0.0/10'],
    ['0.0.0.0', 'unspecified'],
    ['255.255.255.255', 'broadcast'],
    ['::1', 'IPv6 loopback'],
    ['::', 'IPv6 unspecified'],
    ['fe80::1', 'IPv6 link-local'],
    ['fc00::1', 'IPv6 unique-local'],
    ['fd12:3456::1', 'IPv6 unique-local (fd)'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
    ['::ffff:10.0.0.1', 'IPv4-mapped private'],
  ];

  for (const [ip, label] of blocked) {
    it(`blocks ${ip} (${label})`, () => {
      expect(isPrivateOrReservedIp(ip)).toBe(true);
    });
  }

  const allowed: Array<[string, string]> = [
    ['8.8.8.8', 'public DNS'],
    ['93.184.216.34', 'public (example.com)'],
    ['172.15.0.1', 'just below 172.16/12'],
    ['172.32.0.1', 'just above 172.31/12'],
    ['1.1.1.1', 'public'],
    ['2001:4860:4860::8888', 'public IPv6 (Google DNS)'],
    ['::ffff:8.8.8.8', 'IPv4-mapped public'],
  ];

  for (const [ip, label] of allowed) {
    it(`allows ${ip} (${label})`, () => {
      expect(isPrivateOrReservedIp(ip)).toBe(false);
    });
  }

  it('returns false for non-IP strings', () => {
    expect(isPrivateOrReservedIp('example.com')).toBe(false);
    expect(isPrivateOrReservedIp('not-an-ip')).toBe(false);
    expect(isPrivateOrReservedIp('')).toBe(false);
  });
});

describe('assertUrlSafe', () => {
  // A resolver that must never be invoked (used for IP-literal hosts).
  const throwLookup: LookupFn = async () => {
    throw new Error('DNS lookup should not be called for IP literals');
  };
  const publicLookup: LookupFn = async () => [{ address: '8.8.8.8', family: 4 }];
  const privateLookup: LookupFn = async () => [{ address: '10.0.0.5', family: 4 }];

  it('rejects non-http(s) protocols', async () => {
    await expect(assertUrlSafe('ftp://8.8.8.8/', throwLookup)).rejects.toThrow(
      'Only http and https URLs are allowed'
    );
    await expect(assertUrlSafe('file:///etc/passwd', throwLookup)).rejects.toThrow(
      'Only http and https URLs are allowed'
    );
  });

  const blockedLiterals = [
    'http://127.0.0.1/',
    'http://127.0.0.5/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[fe80::1]/',
    'http://[fc00::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:169.254.169.254]/',
  ];

  for (const url of blockedLiterals) {
    it(`rejects literal ${url}`, async () => {
      await expect(assertUrlSafe(url, throwLookup)).rejects.toThrow('private/reserved');
    });
  }

  // Numeric IPv4 encodings the WHATWG URL parser normalizes into hostname.
  const encodedLoopback = [
    'http://2130706433/', // integer form of 127.0.0.1
    'http://0x7f000001/', // hex form
    'http://017700000001/', // octal form
  ];

  for (const url of encodedLoopback) {
    it(`rejects encoded loopback ${url}`, async () => {
      // Sanity: parser normalizes these to the dotted-decimal literal.
      expect(new URL(url).hostname).toBe('127.0.0.1');
      await expect(assertUrlSafe(url, throwLookup)).rejects.toThrow('private/reserved');
    });
  }

  const allowedLiterals = ['http://8.8.8.8/', 'https://93.184.216.34/', 'http://[2001:4860:4860::8888]/'];

  for (const url of allowedLiterals) {
    it(`allows literal ${url}`, async () => {
      await expect(assertUrlSafe(url, throwLookup)).resolves.toBeUndefined();
    });
  }

  it('rejects a DNS name that resolves to a private address', async () => {
    await expect(assertUrlSafe('http://internal.evil.example/', privateLookup)).rejects.toThrow(
      'private/reserved'
    );
  });

  it('allows a DNS name that resolves to a public address', async () => {
    await expect(assertUrlSafe('http://recipes.example.com/', publicLookup)).resolves.toBeUndefined();
  });

  it('rejects a DNS name if ANY resolved address is private', async () => {
    const mixedLookup: LookupFn = async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '10.1.2.3', family: 4 },
    ];
    await expect(assertUrlSafe('http://rebind.example.com/', mixedLookup)).rejects.toThrow(
      'private/reserved'
    );
  });

  it('rejects when the host cannot be resolved', async () => {
    const failLookup: LookupFn = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(assertUrlSafe('http://nonexistent.invalid/', failLookup)).rejects.toThrow(
      'Unable to resolve host'
    );
  });
});

describe('scrapeRecipe redirect handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const recipeHtml = `
    <html>
    <head>
      <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Redirect Pasta",
        "recipeIngredient": ["200g pasta", "2 cups sauce"],
        "recipeInstructions": ["Boil the pasta and add the sauce to serve."]
      }
      </script>
    </head>
    <body></body>
    </html>
  `;

  it('re-validates every redirect hop and blocks a 302 to cloud metadata', async () => {
    // First (and only) fetch: a public literal IP that 302s to the metadata IP.
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 302,
      statusText: 'Found',
      headers: new Headers({ Location: 'http://169.254.169.254/latest/meta-data' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(scrapeRecipe('http://93.184.216.34/recipe')).rejects.toThrow('private/reserved');

    // fetch was called exactly once (the initial public URL) and NEVER for metadata.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('169.254.169.254'))).toBe(false);
  });

  it('follows a redirect to an allowed URL and scrapes it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 301,
        statusText: 'Moved Permanently',
        headers: new Headers({ Location: 'http://8.8.8.8/final-recipe' }),
      })
      .mockResolvedValueOnce(mockFetchResponse(recipeHtml));
    vi.stubGlobal('fetch', fetchMock);

    const recipe = await scrapeRecipe('http://93.184.216.34/recipe');
    expect(recipe.name).toBe('Redirect Pasta');
    expect(recipe.ingredients).toEqual(['200g pasta', '2 cups sauce']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the redirect limit is exceeded', async () => {
    // Always 302 to another allowed public IP -> should exhaust the hop budget.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      statusText: 'Found',
      headers: new Headers({ Location: 'http://8.8.8.8/loop' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(scrapeRecipe('http://8.8.8.8/start')).rejects.toThrow(
      'Too many redirects while fetching URL'
    );
  });

  it('scrapes a direct 200 JSON-LD response through the manual-redirect path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(recipeHtml)));

    const recipe = await scrapeRecipe('http://93.184.216.34/recipe');
    expect(recipe.name).toBe('Redirect Pasta');
    expect(recipe.instructions.length).toBeGreaterThan(0);
  });
});
