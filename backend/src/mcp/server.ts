import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  listShoppingLists,
} from '../services/shoppingListService.js';
import {
  addOrMergeItems,
  getShoppingListItems,
  updateShoppingListItem,
  removeShoppingListItem,
  normalizeItem,
} from '../services/shoppingListItemService.js';
import {
  searchRecipes,
  getRecipeDetail,
  createRecipe,
  updateRecipe,
} from '../services/recipeService.js';
import {
  resolveItemCategories,
  rememberItemCategory,
} from '../services/categoryService.js';
import {
  getMealPlanForWeek,
  getOrCreateMealPlanForWeek,
  addEntryToPlan,
  updateEntry,
  removeEntry,
  mealPlanToShoppingList,
  type MealPlanEntryWithRecipe,
} from '../services/mealPlanService.js';
import { getHouseholdNutritionTargets } from '../services/nutritionProfileService.js';
import {
  getDefaultProduct,
  getDaySnapshot,
  getBookableDates,
  getTrustworthySlots,
} from '../services/snozoneAvailabilityService.js';
import {
  rankPresenceWindows,
  DEFAULT_RECOMMEND_PARAMS,
} from '../services/snozoneRecommendService.js';
import { getBusyness, getCollectedDates } from '../services/snozoneAnalyticsService.js';
import { venueNow, addDays } from '../lib/snozoneWindow.js';
import { verifyShoppingListAccess } from '../lib/shoppingListAccess.js';
import {
  SHOPPING_CATEGORY_SLUGS,
  SHOPPING_CATEGORY_NAMES,
} from '../lib/categories.js';
import {
  createShoppingListItemSchema,
  updateShoppingListItemSchema,
  createRecipeSchema,
  updateRecipeSchema,
} from '../lib/validation.js';
import { logger } from '../lib/logger.js';

/** Positive integer id, shared by several tool inputs. */
const idSchema = z.number().int().positive();

const pageSchema = z
  .number()
  .int()
  .min(1)
  .optional()
  .describe('Page number (default 1)');
const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe('Results per page (max 100)');

/** Human-readable taxonomy, embedded in tool descriptions so the model knows the grouping. */
const categoryTaxonomy = SHOPPING_CATEGORY_SLUGS.map((slug) =>
  slug === SHOPPING_CATEGORY_NAMES[slug].toLowerCase()
    ? slug
    : `${slug} (${SHOPPING_CATEGORY_NAMES[slug]})`
).join(', ');

/**
 * Category as a strict enum for MCP tools. The model calling the tool is
 * expected to categorize each item itself; anything it leaves blank falls
 * back to the server's learned-memory + keyword guesser.
 */
const categorySchema = z
  .enum(SHOPPING_CATEGORY_SLUGS)
  .optional()
  .describe(
    'Store-section category. Pick the best fit yourself for every item ' +
      '(e.g. milk -> dairy, apples -> fruitveg, washing-up liquid -> ' +
      'household). Only omit if genuinely unsure — the server will then ' +
      'try to guess.'
  );

/** Item fields accepted when adding items (no checked/position — new items start unchecked). */
const addItemSchema = createShoppingListItemSchema
  .pick({
    name: true,
    quantity: true,
    unit: true,
    notes: true,
  })
  .extend({ category: categorySchema });

/** Trimmed item shape returned by shopping-list tools. */
function toolItem(item: {
  id: number;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  checked: boolean;
}) {
  const { id, name, unit, category, notes, checked } = item;
  return { id, name, quantity: normalizeItem(item).quantity, unit, category, notes, checked };
}

/** Instructions are stored as a JSON string when created from an array; surface the array. */
function parseInstructions(instructions: string): string | string[] {
  try {
    const parsed = JSON.parse(instructions);
    return Array.isArray(parsed) ? parsed : instructions;
  } catch {
    return instructions;
  }
}

/** Trimmed entry shape returned by meal-plan tools. */
function toolEntry(entry: MealPlanEntryWithRecipe) {
  const { id, dayOfWeek, mealType, recipeId, recipeName, customText, position, nutrition } = entry;
  return { id, dayOfWeek, mealType, recipeId, recipeName, customText, position, nutrition };
}

const ENTRY_ERROR_MESSAGES = {
  plan_not_found: 'Meal plan not found',
  entry_not_found: 'Meal plan entry not found',
  entry_not_in_plan: 'Entry does not belong to this meal plan',
  recipe_not_found: 'Recipe not found',
} as const;

function jsonResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

/**
 * Build an MCP server scoped to one authenticated user. A fresh instance is
 * created per request (stateless Streamable HTTP), so the userId captured here
 * can never leak across users.
 *
 * Tool responses are deliberately trimmed: list tools return summary shapes
 * only, so large households don't flood the model's context. get_recipe is the
 * only full-detail call.
 */
export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'megrob-house-management',
    version: '1.0.0',
  });

  /** registerTool + audit logging: every MCP-originated call is traceable per user. */
  const registerLoggedTool: typeof server.registerTool = (
    name,
    config,
    handler
  ) =>
    server.registerTool(name, config, (async (args: unknown, extra: unknown) => {
      logger.info({ via: 'mcp', userId, tool: name }, 'MCP tool call');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (handler as any)(args, extra);
    }) as typeof handler);

  // ---------------------------------------------------------------- shopping

  registerLoggedTool(
    'list_shopping_lists',
    {
      title: 'List shopping lists',
      description:
        "List the user's shopping lists (household-shared and personal). " +
        'Returns list ids, names, descriptions, and last-updated timestamps. ' +
        'Use the returned id with other shopping-list tools.',
      inputSchema: { page: pageSchema, pageSize: pageSizeSchema },
    },
    async ({ page, pageSize }) => {
      const result = await listShoppingLists(userId, { page, pageSize });
      return jsonResult({
        lists: result.data.map((list) => ({
          id: list.id,
          name: list.name,
          description: list.description,
          updatedAt: list.updatedAt,
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
    }
  );

  registerLoggedTool(
    'get_shopping_list',
    {
      title: 'Get shopping list items',
      description:
        'Get the items on one shopping list (unchecked and checked), paginated. ' +
        'Returns item ids for use with update/remove tools.',
      inputSchema: {
        listId: idSchema.describe('Shopping list id (from list_shopping_lists)'),
        page: pageSchema,
        pageSize: pageSizeSchema,
      },
    },
    async ({ listId, page, pageSize }) => {
      const result = await getShoppingListItems(userId, listId, {
        page,
        pageSize,
      });
      if (!result) return errorResult('Shopping list not found');
      return jsonResult({
        list: { id: result.list.id, name: result.list.name },
        items: result.data.map(toolItem),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
    }
  );

  registerLoggedTool(
    'add_shopping_list_items',
    {
      title: 'Add items to a shopping list',
      description:
        'Add one or more items to a shopping list. Items matching an existing ' +
        'unchecked item (same name/unit) are merged: quantities are summed ' +
        'rather than creating duplicates. Assign each item a category so the ' +
        `list groups by store section. Categories: ${categoryTaxonomy}.`,
      inputSchema: {
        listId: idSchema.describe('Shopping list id (from list_shopping_lists)'),
        items: z
          .array(addItemSchema)
          .min(1)
          .max(50)
          .describe('Items to add (max 50 per call)'),
      },
    },
    async ({ listId, items }) => {
      const list = await verifyShoppingListAccess(listId, userId);
      if (!list) return errorResult('Shopping list not found');

      // The calling model normally categorizes items itself; fill in any it
      // left blank from learned memory / the keyword dictionary.
      const results = await addOrMergeItems(
        await resolveItemCategories(
          userId,
          items.map((item) => ({
            listId,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
            category: item.category,
            createdBy: userId,
            updatedBy: userId,
          }))
        )
      );

      return jsonResult({
        list: { id: list.id, name: list.name },
        added: results.map((r) => ({
          ...toolItem(r.item),
          merged: r.merged,
        })),
      });
    }
  );

  registerLoggedTool(
    'update_shopping_list_item',
    {
      title: 'Update a shopping list item',
      description:
        'Update fields on one shopping list item. Set checked=true to check it ' +
        'off, checked=false to uncheck. Only provided fields change. ' +
        'Changing category also teaches the server the preferred category ' +
        `for that item name. Categories: ${categoryTaxonomy}.`,
      inputSchema: {
        listId: idSchema,
        itemId: idSchema.describe('Item id (from get_shopping_list)'),
        ...updateShoppingListItemSchema.shape,
        category: categorySchema,
      },
    },
    async ({ listId, itemId, ...input }) => {
      const result = await updateShoppingListItem(userId, listId, itemId, input);
      if (!result.ok) {
        return errorResult(
          result.reason === 'list_not_found'
            ? 'Shopping list not found'
            : 'Shopping list item not found'
        );
      }
      if (input.category) {
        // Category set via MCP is usually the user telling the model to
        // recategorize — remember it for future adds of this item.
        await rememberItemCategory(userId, result.item.name, input.category);
      }
      return jsonResult(toolItem(result.item));
    }
  );

  registerLoggedTool(
    'remove_shopping_list_item',
    {
      title: 'Remove a shopping list item',
      description: 'Remove one item from a shopping list.',
      inputSchema: {
        listId: idSchema,
        itemId: idSchema.describe('Item id (from get_shopping_list)'),
      },
    },
    async ({ listId, itemId }) => {
      const result = await removeShoppingListItem(userId, listId, itemId);
      if (!result.ok) {
        return errorResult(
          result.reason === 'list_not_found'
            ? 'Shopping list not found'
            : 'Shopping list item not found'
        );
      }
      return jsonResult({ removed: toolItem(result.item) });
    }
  );

  // ----------------------------------------------------------------- recipes

  registerLoggedTool(
    'search_recipes',
    {
      title: 'Search recipes',
      description:
        "Search the user's recipes by text (name, description, or ingredient), " +
        'cuisine, difficulty, meal type, or dietary tags. Returns summaries — ' +
        'use get_recipe with an id for ingredients and instructions.',
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe('Text search across name, description, and ingredients'),
        cuisine: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        mealTypes: z
          .array(z.string())
          .optional()
          .describe('e.g. ["dinner"] — matches any of the given meal types'),
        dietary: z
          .array(z.string())
          .optional()
          .describe('e.g. ["vegetarian"] — recipe must have ALL given tags'),
        favorite: z.boolean().optional().describe('Only favorited recipes'),
        page: pageSchema,
        pageSize: pageSizeSchema,
      },
    },
    async ({ search, cuisine, difficulty, mealTypes, dietary, favorite, page, pageSize }) => {
      const result = await searchRecipes(userId, {
        search,
        cuisine,
        difficulty,
        mealTypes,
        dietary,
        favorite,
        page,
        pageSize,
      });
      return jsonResult({
        recipes: result.data.map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          servings: recipe.servings,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          difficulty: recipe.difficulty,
          cuisine: recipe.cuisine,
          rating: recipe.rating,
          isFavorite: recipe.isFavorite,
          categories: recipe.categories.map((cat) => ({
            type: cat.categoryType,
            value: cat.categoryValue,
          })),
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
    }
  );

  registerLoggedTool(
    'get_recipe',
    {
      title: 'Get a recipe',
      description:
        'Get one recipe in full: ingredients, instructions, timings, and tags.',
      inputSchema: {
        recipeId: idSchema.describe('Recipe id (from search_recipes)'),
      },
    },
    async ({ recipeId }) => {
      const recipe = await getRecipeDetail(userId, recipeId);
      if (!recipe) return errorResult('Recipe not found');
      return jsonResult({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        servings: recipe.servings,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        instructions: parseInstructions(recipe.instructions),
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        notes: recipe.notes,
        rating: recipe.rating,
        isFavorite: recipe.isFavorite,
        sourceUrl: recipe.sourceUrl,
        ingredients: recipe.ingredients.map((ing) => ({
          id: ing.id,
          name: ing.name,
          quantity: ing.quantity ? parseFloat(ing.quantity) : null,
          unit: ing.unit,
          notes: ing.notes,
        })),
        categories: recipe.categories.map((cat) => ({
          type: cat.categoryType,
          value: cat.categoryValue,
        })),
        // Per-serving, computed asynchronously; null until first enrichment
        nutrition: recipe.nutrition,
      });
    }
  );

  registerLoggedTool(
    'create_recipe',
    {
      title: 'Create a recipe',
      description:
        'Create a new recipe with ingredients, instructions (array of steps), ' +
        "and optional category tags. It is shared with the user's household.",
      inputSchema: { ...createRecipeSchema.shape },
    },
    async (input) => {
      const recipe = await createRecipe(userId, input);
      return jsonResult({
        id: recipe.id,
        name: recipe.name,
        message: 'Recipe created',
      });
    }
  );

  registerLoggedTool(
    'update_recipe',
    {
      title: 'Update a recipe',
      description:
        'Update fields on a recipe. Only provided fields change; providing ' +
        'ingredients or categories REPLACES the full set, so include existing ' +
        'entries you want to keep (fetch them with get_recipe first).',
      inputSchema: {
        recipeId: idSchema.describe('Recipe id (from search_recipes)'),
        ...updateRecipeSchema.shape,
      },
    },
    async ({ recipeId, ...input }) => {
      const recipe = await updateRecipe(userId, recipeId, input);
      if (!recipe) return errorResult('Recipe not found');
      return jsonResult({
        id: recipe.id,
        name: recipe.name,
        message: 'Recipe updated',
      });
    }
  );

  // -------------------------------------------------------------- meal plans

  const weekSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .describe(
      'Week start date in YYYY-MM-DD format. Must be the MONDAY of the week ' +
        '(ISO week semantics).'
    );
  const dayOfWeekSchema = z
    .number()
    .int()
    .min(0)
    .max(6)
    .describe('Day of week: 0=Monday, 1=Tuesday, ... 6=Sunday');
  const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

  registerLoggedTool(
    'get_meal_plan',
    {
      title: 'Get the meal plan for a week',
      description:
        "Get the user's meal plan for one week, with its entries (day, meal " +
        'type, linked recipe or custom text). Recipe entries include ' +
        'per-serving nutrition (calories/protein/carbs/fat) when computed — ' +
        'combine with get_nutrition_targets to plan macro-aware weeks. ' +
        'Returns { plan: null } when no plan exists for that week yet — ' +
        'add_meal_plan_entry will create one. Entry ids are used with the ' +
        'update/remove entry tools.',
      inputSchema: { week: weekSchema },
    },
    async ({ week }) => {
      const plan = await getMealPlanForWeek(userId, week);
      if (!plan) return jsonResult({ plan: null });
      return jsonResult({
        plan: {
          id: plan.id,
          name: plan.name,
          weekStartDate: plan.weekStartDate,
          entries: plan.entries.map(toolEntry),
        },
      });
    }
  );

  registerLoggedTool(
    'add_meal_plan_entry',
    {
      title: 'Add a meal to a weekly plan',
      description:
        'Add one meal to a weekly plan, creating the plan for that week if ' +
        'none exists. Provide either recipeId (from search_recipes) for a ' +
        'recipe-linked meal, or customText for free-form meals like ' +
        '"Leftovers" or "Eating out".',
      inputSchema: {
        week: weekSchema,
        dayOfWeek: dayOfWeekSchema,
        mealType: mealTypeSchema,
        recipeId: idSchema
          .optional()
          .describe('Recipe id (from search_recipes)'),
        customText: z
          .string()
          .max(200)
          .optional()
          .describe('Free-form meal text, when no recipe is linked'),
      },
    },
    async ({ week, dayOfWeek, mealType, recipeId, customText }) => {
      if (!recipeId && !customText) {
        return errorResult('Either recipeId or customText is required');
      }
      const { plan, created } = await getOrCreateMealPlanForWeek(userId, week);
      const result = await addEntryToPlan(userId, plan.id, {
        dayOfWeek,
        mealType,
        recipeId,
        customText,
      });
      if (!result.ok) return errorResult(ENTRY_ERROR_MESSAGES[result.reason]);
      return jsonResult({
        mealPlanId: plan.id,
        weekStartDate: plan.weekStartDate,
        planCreated: created,
        entry: toolEntry(result.entry),
      });
    }
  );

  registerLoggedTool(
    'update_meal_plan_entry',
    {
      title: 'Update a meal plan entry',
      description:
        'Update one meal plan entry (move it to another day or meal type, or ' +
        'swap the recipe/custom text). Only provided fields change. An entry ' +
        'must keep either a recipe or custom text.',
      inputSchema: {
        mealPlanId: idSchema.describe('Meal plan id (from get_meal_plan)'),
        entryId: idSchema.describe('Entry id (from get_meal_plan)'),
        dayOfWeek: dayOfWeekSchema.optional(),
        mealType: mealTypeSchema.optional(),
        recipeId: idSchema
          .nullable()
          .optional()
          .describe('New recipe id, or null to unlink the recipe'),
        customText: z
          .string()
          .max(200)
          .nullable()
          .optional()
          .describe('New free-form text, or null to clear it'),
      },
    },
    async ({ mealPlanId, entryId, ...input }) => {
      const clearsRecipe = input.recipeId === null;
      const clearsCustomText = input.customText === null || input.customText === '';
      if (clearsRecipe && clearsCustomText) {
        return errorResult('A meal entry must have either a recipe or custom text');
      }
      const result = await updateEntry(userId, mealPlanId, entryId, input);
      if (!result.ok) return errorResult(ENTRY_ERROR_MESSAGES[result.reason]);
      return jsonResult({ entry: toolEntry(result.entry) });
    }
  );

  registerLoggedTool(
    'remove_meal_plan_entry',
    {
      title: 'Remove a meal plan entry',
      description: 'Remove one meal from a weekly plan.',
      inputSchema: {
        mealPlanId: idSchema.describe('Meal plan id (from get_meal_plan)'),
        entryId: idSchema.describe('Entry id (from get_meal_plan)'),
      },
    },
    async ({ mealPlanId, entryId }) => {
      const result = await removeEntry(userId, mealPlanId, entryId);
      if (!result.ok) return errorResult(ENTRY_ERROR_MESSAGES[result.reason]);
      return jsonResult({ removed: toolEntry(result.entry) });
    }
  );

  registerLoggedTool(
    'meal_plan_to_shopping_list',
    {
      title: 'Generate a shopping list from a meal plan',
      description:
        "Add all ingredients from a meal plan's linked recipes to a shopping " +
        'list. Quantities scale by how many times a recipe appears in the ' +
        'plan, and duplicate items merge (quantities summed). Target either ' +
        'an existing list (shoppingListId) or a new one (newListName) — ' +
        'exactly one is required.',
      inputSchema: {
        mealPlanId: idSchema.describe('Meal plan id (from get_meal_plan)'),
        shoppingListId: idSchema
          .optional()
          .describe('Existing shopping list to add ingredients to'),
        newListName: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe('Name for a new shopping list to create'),
      },
    },
    async ({ mealPlanId, shoppingListId, newListName }) => {
      if (!shoppingListId && !newListName) {
        return errorResult('Either shoppingListId or newListName is required');
      }
      const result = await mealPlanToShoppingList(userId, mealPlanId, {
        shoppingListId,
        newListName,
      });
      if (!result.ok) {
        const messages = {
          plan_not_found: 'Meal plan not found',
          no_recipes:
            'No recipes found in this meal plan. Add recipe-linked entries first.',
          no_ingredients: 'No ingredients found in the linked recipes',
          list_not_found: 'Shopping list not found',
          missing_target: 'Either shoppingListId or newListName is required',
        } as const;
        return errorResult(messages[result.reason]);
      }
      return jsonResult({
        list: { id: result.list.id, name: result.list.name },
        addedCount: result.addedCount,
        mergedCount: result.mergedCount,
        totalIngredients: result.totalIngredients,
        totalItemsOnList: result.items.length,
      });
    }
  );

  // --------------------------------------------------------------- nutrition

  registerLoggedTool(
    'get_nutrition_targets',
    {
      title: 'Get household nutrition targets',
      description:
        'Daily nutrition targets (calories, protein, carbs, fat, fibre, ' +
        "salt) for each member of the user's household, derived from their " +
        'nutrition profiles. Members without a profile have targets: null. ' +
        'Never includes raw measurements. Use with the per-serving nutrition ' +
        'in get_meal_plan/get_recipe to plan weeks that hit targets — the ' +
        'household convention is that every member eats one serving of each ' +
        'planned meal.',
      inputSchema: {},
    },
    async () => {
      const members = await getHouseholdNutritionTargets(userId);
      return jsonResult({
        members: members.map((member) => ({
          name: member.name,
          isSelf: member.isSelf,
          targets: member.targets
            ? {
                caloriesKcal: member.targets.caloriesKcal,
                proteinG: member.targets.proteinG,
                carbsG: member.targets.carbsG,
                fatG: member.targets.fatG,
                fiberG: member.targets.fiberG,
                saltG: member.targets.saltG,
              }
            : null,
        })),
      });
    }
  );

  // ----------------------------------------------------------------- snozone

  /**
   * Snozone tools read the collector's Postgres record and NEVER call Snozone.
   * That is not incidental: the collector is the sole upstream caller at a
   * fixed 7 requests per 30 minutes, and a tool a model can invoke in a loop is
   * exactly what would turn a defensible request rate into an indefensible one
   * (PLAN.md §1, brief.md §7).
   *
   * Responses are aggregated hard. A day is ~125 five-minute slots with
   * eighteen fields each; returning that raw would spend thousands of tokens to
   * answer "is Wednesday evening busy". So availability and busyness both come
   * back hourly, and the ranking comes back truncated.
   */

  const snozoneDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .describe('Session date, YYYY-MM-DD, venue-local');

  registerLoggedTool(
    'list_snozone_dates',
    {
      title: 'List bookable Snozone dates',
      description:
        'Dates the Snozone slope currently has bookable slots for, as last ' +
        'observed by the collector. Use one of these with the other snozone ' +
        'tools. Reads a stored record — never contacts Snozone.',
      inputSchema: {},
    },
    async () => {
      const product = await getDefaultProduct();
      if (!product) return jsonResult({ dates: [], lastObservedAt: null });
      const result = await getBookableDates(product.id);
      return jsonResult({ dates: result.dates, lastObservedAt: result.lastRunAt });
    }
  );

  registerLoggedTool(
    'get_snozone_availability',
    {
      title: 'Get Snozone occupancy for a date',
      description:
        'How busy the slope is on one date, summarised by hour: peak and ' +
        'quietest headcount, and how many slots are still bookable. Headcount ' +
        'is everyone ON the slope, not just sessions starting that hour — most ' +
        'riders started earlier and are still on it. IMPORTANT: for dates more ' +
        'than about two days out this reports BOOKINGS SO FAR, not expected ' +
        'attendance, so a near-empty future date means "few have booked yet", ' +
        'not "it will be quiet".',
      inputSchema: { date: snozoneDateSchema },
    },
    async ({ date }) => {
      const product = await getDefaultProduct();
      if (!product) return errorResult('No Snozone product is configured.');

      const day = await getDaySnapshot(product.id, date);
      // Expired readings are corrupt once a slot has started — a captured
      // example shows 86 people on an 80-place slope (brief.md §10.2a).
      const usable = day.slots.filter((s) => !s.expired);
      if (usable.length === 0) {
        return jsonResult({ date, hours: [], note: 'No usable readings for this date.' });
      }

      const byHour = new Map<string, typeof usable>();
      for (const slot of usable) {
        const hour = slot.time.slice(0, 2);
        const bucket = byHour.get(hour);
        if (bucket) bucket.push(slot);
        else byHour.set(hour, [slot]);
      }

      const hours = [...byHour.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, slots]) => {
          const peak = slots.reduce((m, s) => (s.onSlope > m.onSlope ? s : m), slots[0]);
          const quiet = slots.reduce((m, s) => (s.onSlope < m.onSlope ? s : m), slots[0]);
          return {
            hour: `${hour}:00`,
            peakOnSlope: peak.onSlope,
            peakAt: peak.time,
            quietestOnSlope: quiet.onSlope,
            quietestAt: quiet.time,
            bookableSlots: slots.filter((s) => s.available).length,
            slots: slots.length,
          };
        });

      return jsonResult({
        date,
        observedAt: day.observedAt,
        isStale: day.isStale,
        capacity: day.summary.capacity,
        peakOnSlope: day.summary.peakOnSlope,
        // Reported, never assumed by a caller: opening hours vary day to day,
        // and Friday runs an hour later than midweek (frontend plan §5.1).
        openFrom: usable[0].time,
        openTo: usable[usable.length - 1].time,
        hours,
      });
    }
  );

  registerLoggedTool(
    'recommend_snozone_slot',
    {
      title: 'Recommend the quietest Snozone slot',
      description:
        'The quietest slot to book on a date, ranked across the whole time you ' +
        'would be present — arriving early, the session itself, and lingering ' +
        'after — rather than just the booked hour. Those give genuinely ' +
        'different answers. Returns the pick plus the next best few, and a ' +
        'confidence: "thin" or "none" means the date has too few bookings so ' +
        'far to judge, which is normal for dates more than about two days out. ' +
        'Say so rather than presenting a confident pick.',
      inputSchema: {
        date: snozoneDateSchema,
        after: z
          .number()
          .min(0)
          .max(23)
          .optional()
          .describe(
            `Earliest hour to consider, e.g. 16 for 4pm (default ${DEFAULT_RECOMMEND_PARAMS.after})`
          ),
        session: z
          .number()
          .int()
          .min(15)
          .max(480)
          .optional()
          .describe(`Session length in minutes (default ${DEFAULT_RECOMMEND_PARAMS.session})`),
        early: z
          .number()
          .int()
          .min(0)
          .max(120)
          .optional()
          .describe(
            `Minutes on the slope before the session starts (default ${DEFAULT_RECOMMEND_PARAMS.early})`
          ),
        stay: z
          .number()
          .int()
          .min(0)
          .max(120)
          .optional()
          .describe(
            `Minutes lingering after it ends (default ${DEFAULT_RECOMMEND_PARAMS.stay})`
          ),
      },
    },
    async ({ date, after, session, early, stay }) => {
      const product = await getDefaultProduct();
      if (!product) return errorResult('No Snozone product is configured.');

      const params = {
        after: after ?? DEFAULT_RECOMMEND_PARAMS.after,
        session: session ?? DEFAULT_RECOMMEND_PARAMS.session,
        early: early ?? DEFAULT_RECOMMEND_PARAMS.early,
        stay: stay ?? DEFAULT_RECOMMEND_PARAMS.stay,
      };

      const slots = await getTrustworthySlots(product.id, date);
      const result = rankPresenceWindows(slots, date, venueNow(new Date()), params);

      return jsonResult({
        date,
        params,
        pick: result.pick,
        // Truncated: the full ranking is one entry per five-minute slot, and
        // nobody needs the ninetieth best time to board.
        alternatives: result.ranked.slice(1, 5),
        confidence: result.confidence,
        note: result.note,
      });
    }
  );

  registerLoggedTool(
    'get_snozone_busyness',
    {
      title: 'Get typical Snozone busyness by weekday and hour',
      description:
        'Typical (median) headcount on the slope for each weekday and hour ' +
        'across all collected history — the answer to "when is it usually ' +
        'quiet". Returns a maturity verdict: when ready is false the sample is ' +
        'too small to draw conclusions from, and you must say so rather than ' +
        'reporting the numbers as a pattern. An hour missing from a weekday ' +
        'means the slope was CLOSED then, not that it was empty — opening ' +
        'hours vary by day.',
      inputSchema: {
        from: snozoneDateSchema.optional().describe('Start of range (default: a year back)'),
        to: snozoneDateSchema.optional().describe('End of range (default: today)'),
      },
    },
    async ({ from, to }) => {
      const today = venueNow(new Date()).date;
      const resolvedTo = to ?? today;
      const resolvedFrom = from ?? addDays(resolvedTo, -365);
      if (resolvedFrom > resolvedTo) return errorResult('from must be on or before to');

      const busyness = await getBusyness({ from: resolvedFrom, to: resolvedTo });
      const collected = await getCollectedDates();

      // Hourly, like get_snozone_availability: the per-slot grid runs to ~900
      // cells, and nobody needs five-minute resolution for "when is it quiet".
      const peakByCell = new Map<string, number>();
      for (const cell of busyness.cells) {
        const key = `${cell.dow}:${cell.slotTime.slice(0, 2)}`;
        peakByCell.set(key, Math.max(peakByCell.get(key) ?? 0, cell.medianOnSlope));
      }

      const dayNames = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
      ];
      const byDay = new Map<number, { hour: string; typicalOnSlope: number }[]>();
      for (const [key, value] of peakByCell) {
        const [dow, hour] = key.split(':').map(Number);
        const list = byDay.get(dow) ?? [];
        list.push({
          hour: `${String(hour).padStart(2, '0')}:00`,
          typicalOnSlope: Math.round(value),
        });
        byDay.set(dow, list);
      }

      const datesPerDow = new Map(busyness.datesPerDow.map((d) => [d.dow, d.dates]));

      return jsonResult({
        range: { from: resolvedFrom, to: resolvedTo },
        datesCollected: collected.length,
        maturity: busyness.maturity,
        weekdays: [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
          day: dayNames[dow],
          datesSampled: datesPerDow.get(dow) ?? 0,
          hours: (byDay.get(dow) ?? []).sort((a, b) => a.hour.localeCompare(b.hour)),
        })),
      });
    }
  );

  return server;
}
