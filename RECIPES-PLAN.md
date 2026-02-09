# Recipes Feature Implementation Plan

## Overview
Add a comprehensive recipes section to the home management app, allowing users to store, organize, and manage their recipes with support for URL scraping and manual entry.

---

## Feature Requirements

### Core Features (User Requested)
1. **Add recipe via URL** - Scrape recipe from website using schema.org/Recipe structured data
2. **Add recipe manually** - Full form for entering recipe details
3. **Edit recipes** - All recipes editable regardless of how they were added
4. **Recipe listing** - Browse all recipes with filtering/sorting
5. **Categories & Tags**:
   - Meal type: Starter, Main, Side, Dessert, Snack, Breakfast, Lunch, Dinner
   - Dietary: Vegetarian, Vegan, Pescatarian, Gluten-Free, Dairy-Free, Keto, Paleo
   - Allergens: Contains Nuts, Contains Eggs, Contains Dairy, Contains Gluten, Contains Shellfish, Contains Soy
6. **Auto-detection** - Automatically tag allergens based on ingredient list

### Additional Recommended Features

**High Priority (implement in v1):**
- **Serving size scaling** - Adjust ingredient quantities for different serving sizes
- **Prep & cook time** - Track and display preparation and cooking times
- **Favorite recipes** - Star/favorite recipes for quick access
- **Search & filter** - Search by name, ingredient, filter by category/dietary/allergen
- **Shopping list integration** - Add recipe ingredients directly to a shopping list (new or existing)
- **Recipe source URL** - Store and display original source for scraped recipes

**Medium Priority (v2):**
- **Cuisine type** - Italian, Mexican, Asian, Indian, American, etc.
- **Difficulty level** - Easy, Medium, Hard
- **Personal notes** - Add modifications or tips to recipes
- **Recipe rating** - 1-5 star personal rating
- **Print-friendly view** - Clean print layout

**Lower Priority (future):**
- **Step-by-step cooking mode** - Large font, one step at a time
- **Equipment needed** - List tools/appliances required
- **Nutritional info** - Calories, macros (optional)
- **Recipe sharing** - Share with family members

---

## Database Schema

### Tables to Create

```typescript
// backend/src/db/schema.ts

// Main recipes table (shared household model - all users can see/edit)
export const recipes = pgTable('recipes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  servings: integer('servings').default(4),
  prepTimeMinutes: integer('prep_time_minutes'),
  cookTimeMinutes: integer('cook_time_minutes'),
  instructions: text('instructions').notNull(), // JSON array of steps
  sourceUrl: text('source_url'), // Original URL if scraped
  status: text('status').default('ready').notNull(), // 'pending' | 'ready' | 'failed'
  errorMessage: text('error_message'), // Error details if import failed
  difficulty: text('difficulty'), // 'easy' | 'medium' | 'hard'
  cuisine: text('cuisine'),
  notes: text('notes'),
  rating: integer('rating'), // 1-5
  isFavorite: boolean('is_favorite').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by').notNull().references(() => user.id),
  updatedBy: text('updated_by').notNull().references(() => user.id),
});

// Recipe ingredients (separate table for better querying)
export const recipeIngredients = pgTable('recipe_ingredients', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id').notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: numeric('quantity'),
  unit: text('unit'),
  notes: text('notes'), // e.g., "finely chopped"
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Recipe categories (many-to-many via junction table)
export const recipeCategories = pgTable('recipe_categories', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id').notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  categoryType: text('category_type').notNull(), // 'meal_type' | 'dietary' | 'allergen' | 'cuisine'
  categoryValue: text('category_value').notNull(), // e.g., 'vegetarian', 'contains_nuts'
});
```

---

## API Endpoints

### Recipe Routes (`/api/recipes`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recipes` | List recipes with pagination, search, filters |
| GET | `/api/recipes/:id` | Get single recipe with ingredients and categories |
| POST | `/api/recipes` | Create recipe manually |
| POST | `/api/recipes/import` | Import recipe from URL (scraping) |
| PATCH | `/api/recipes/:id` | Update recipe |
| DELETE | `/api/recipes/:id` | Delete recipe |
| POST | `/api/recipes/:id/favorite` | Toggle favorite status |
| POST | `/api/recipes/:id/to-shopping-list` | Add ingredients to shopping list |

### Query Parameters for GET `/api/recipes`
- `page`, `pageSize` - Pagination
- `search` - Search in name, description, ingredients
- `mealType` - Filter by meal type
- `dietary` - Filter by dietary (comma-separated for multiple)
- `allergenFree` - Exclude recipes with specific allergens
- `favorite` - Only show favorites
- `cuisine` - Filter by cuisine type

---

## URL Scraping Implementation

### Approach
Use schema.org/Recipe structured data (JSON-LD) which most recipe sites include.
**Background processing via queuebear** for reliable scraping without blocking requests.

### Architecture
```
User submits URL → API creates pending recipe → Queues job → Returns immediately
                                                    ↓
                              Queuebear worker picks up job
                                                    ↓
                              Scrapes URL, parses data, updates recipe
                                                    ↓
                              Recipe status: "pending" → "ready" (or "failed")
```

### Recipe Status Flow
- `pending` - URL submitted, awaiting scraping
- `ready` - Successfully scraped and saved
- `failed` - Scraping failed (store error message for user)

### Backend Implementation
```typescript
// backend/src/lib/recipeScraper.ts

import * as cheerio from 'cheerio';

interface ScrapedRecipe {
  name: string;
  description?: string;
  prepTime?: string; // ISO 8601 duration
  cookTime?: string;
  servings?: number;
  ingredients: string[];
  instructions: string[];
  sourceUrl: string;
}

export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  // 1. Fetch the URL
  // 2. Parse HTML with cheerio
  // 3. Look for JSON-LD script tags with @type: "Recipe"
  // 4. Parse and return structured data
  // 5. Fallback: Look for common recipe markup patterns
}

// Parse ISO 8601 duration to minutes
export function parseDuration(duration: string): number | null {
  // PT30M -> 30, PT1H30M -> 90
}
```

### Queuebear Worker Setup
```typescript
// backend/src/workers/recipeImportWorker.ts

import { QueueBear } from 'queuebear';
import { scrapeRecipe } from '../lib/recipeScraper';
import { parseIngredient } from '../lib/ingredientParser';
import { detectAllergens } from '../lib/allergenDetector';
import { db } from '../db';
import { recipes, recipeIngredients, recipeCategories } from '../db/schema';

const qb = new QueueBear({ /* config */ });

// Define the import job handler
qb.process('recipe-import', async (job) => {
  const { recipeId, url } = job.data;

  try {
    // 1. Scrape the recipe
    const scraped = await scrapeRecipe(url);

    // 2. Parse ingredients
    const parsedIngredients = scraped.ingredients.map(parseIngredient);

    // 3. Detect allergens
    const allergens = detectAllergens(scraped.ingredients);

    // 4. Update recipe in database
    await db.update(recipes)
      .set({
        name: scraped.name,
        description: scraped.description,
        servings: scraped.servings,
        prepTimeMinutes: parseDuration(scraped.prepTime),
        cookTimeMinutes: parseDuration(scraped.cookTime),
        instructions: JSON.stringify(scraped.instructions),
        status: 'ready',
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    // 5. Insert ingredients
    // 6. Insert auto-detected categories/allergens

  } catch (error) {
    // Mark recipe as failed
    await db.update(recipes)
      .set({ status: 'failed', errorMessage: error.message })
      .where(eq(recipes.id, recipeId));
  }
});
```

### Import API Endpoint
```typescript
// POST /api/recipes/import
app.post('/import', async (c) => {
  const { url } = await c.req.json();
  const userId = getUserId(c);

  // 1. Create pending recipe
  const [recipe] = await db.insert(recipes).values({
    name: 'Importing...',
    sourceUrl: url,
    status: 'pending',
    instructions: '[]',
    createdBy: userId,
    updatedBy: userId,
  }).returning();

  // 2. Queue the import job
  await qb.add('recipe-import', { recipeId: recipe.id, url });

  // 3. Return immediately with pending recipe
  return c.json(recipe, 202); // 202 Accepted
});
```

### Ingredient Parser
```typescript
// backend/src/lib/ingredientParser.ts

interface ParsedIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
  notes: string | null; // "finely chopped", "room temperature"
}

export function parseIngredient(text: string): ParsedIngredient {
  // Parse "2 cups all-purpose flour, sifted" into:
  // { quantity: 2, unit: 'cups', name: 'all-purpose flour', notes: 'sifted' }

  // Handle fractions: "1/2 cup" -> 0.5
  // Handle ranges: "2-3 cloves" -> use first number
  // Handle unicode fractions: "½ cup" -> 0.5
}

// Scale ingredients based on serving multiplier
export function scaleIngredient(ingredient: ParsedIngredient, multiplier: number): ParsedIngredient {
  return {
    ...ingredient,
    quantity: ingredient.quantity ? ingredient.quantity * multiplier : null,
  };
}
```

### Allergen Auto-Detection
```typescript
// backend/src/lib/allergenDetector.ts

const ALLERGEN_KEYWORDS = {
  nuts: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'peanut', 'nut'],
  eggs: ['egg', 'eggs', 'mayonnaise'],
  dairy: ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'yoghurt'],
  gluten: ['flour', 'bread', 'pasta', 'wheat', 'barley', 'rye'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel'],
  soy: ['soy', 'tofu', 'tempeh', 'edamame'],
};

export function detectAllergens(ingredients: string[]): string[] {
  // Check each ingredient against keyword lists
  // Return array of detected allergens
}

export function detectDietary(ingredients: string[]): string[] {
  // Check for meat/fish to determine vegetarian/vegan/pescatarian
}
```

---

## Frontend Components

### New Files to Create

**Pages:**
- `src/pages/RecipesPage.tsx` - Recipe listing with filters
- `src/pages/RecipeDetailPage.tsx` - View/edit single recipe
- `src/pages/AddRecipePage.tsx` - Manual recipe entry form

**Organisms:**
- `src/components/organisms/RecipeCard.tsx` - Recipe card for grid view
- `src/components/organisms/RecipeDetail.tsx` - Full recipe display
- `src/components/organisms/RecipeForm.tsx` - Form for create/edit
- `src/components/organisms/RecipeFilters.tsx` - Filter sidebar/panel

**Molecules:**
- `src/components/molecules/ImportRecipeBottomSheet.tsx` - URL import dialog
- `src/components/molecules/IngredientInput.tsx` - Add/edit ingredient row
- `src/components/molecules/ServingScaler.tsx` - Adjust servings with auto-scaled ingredients
- `src/components/molecules/CategoryPicker.tsx` - Select categories/tags
- `src/components/molecules/AddToShoppingListBottomSheet.tsx` - Select ingredients + choose existing list or create new

**Atoms:**
- `src/components/atoms/Badge.tsx` - Already exists, use for tags
- `src/components/atoms/StarRating.tsx` - 1-5 star rating input
- `src/components/atoms/TimeBadge.tsx` - Display prep/cook time

**Hooks:**
- `src/hooks/recipe/useRecipes.ts` - List recipes with filters
- `src/hooks/recipe/useRecipe.ts` - Single recipe
- `src/hooks/recipe/useRecipeData.ts` - CRUD operations
- `src/hooks/recipe/useRecipeImport.ts` - URL import mutation

**Types:**
- `src/types/recipe.ts` - Recipe, RecipeIngredient, RecipeCategory interfaces

**Schemas:**
- Add to `src/lib/schemas.ts` - createRecipeSchema, updateRecipeSchema, importRecipeSchema

---

## Implementation Phases

### Phase 1: Foundation
1. Create database schema and run migrations
2. Create backend CRUD routes for recipes
3. Create frontend types and hooks
4. Create RecipesPage with basic listing
5. Create RecipeDetailPage with view mode

### Phase 2: Manual Entry
1. Create RecipeForm organism
2. Create IngredientInput molecule
3. Create CategoryPicker molecule
4. Implement create/edit functionality
5. Add validation with Zod schemas

### Phase 3: URL Import
1. Install cheerio and queuebear dependencies
2. Create recipeScraper utility
3. Create ingredientParser utility
4. Create allergenDetector utility
5. Set up queuebear worker (recipeImportWorker.ts)
6. Create import API endpoint (POST /recipes/import)
7. Create ImportRecipeBottomSheet with status polling
8. Test with popular recipe sites (AllRecipes, BBC Good Food, etc.)

### Phase 4: Search & Filters
1. Add search to backend query
2. Add filter parameters to backend
3. Create RecipeFilters component
4. Implement frontend filtering UI

### Phase 5: Enhanced Features
1. Implement serving size scaling
2. Add favorite toggle functionality
3. Create shopping list integration
4. Add StarRating component
5. Implement print-friendly view

---

## Critical Files to Modify

**Backend:**
- `backend/src/db/schema.ts` - Add recipe tables
- `backend/src/index.ts` - Register recipe routes
- `backend/src/workers/recipeImportWorker.ts` - New file: queuebear worker for scraping
- `backend/package.json` - Add cheerio, queuebear dependencies

**Frontend:**
- `frontend/src/App.tsx` - Add recipe routes
- `frontend/src/lib/schemas.ts` - Add recipe schemas
- `frontend/src/pages/HomePage.tsx` - Add recipes navigation card

---

## Dependencies to Add

**Backend:**
- `cheerio` - HTML parsing for recipe scraping
- `queuebear` - Background job queue for async recipe imports

**Frontend:**
- None required (using existing stack)

---

## Design Decisions (Confirmed)

1. **Images**: Skip for MVP - no image handling needed
2. **Ingredient parsing**: Yes - parse "2 cups flour" into structured data (quantity, unit, name) to enable serving scaling
3. **Shopping list integration**: Both options - user can add to existing list OR create a new list
4. **Sharing model**: Shared household - recipes visible to all household members (same as shopping lists)
5. **URL scraping**: Background worker using queuebear - non-blocking, with status tracking (pending/ready/failed)
