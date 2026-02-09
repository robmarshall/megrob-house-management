import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseDuration, scrapeRecipe } from './recipeScraper';

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
