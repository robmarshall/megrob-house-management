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
import { verifyShoppingListAccess } from '../lib/shoppingListAccess.js';
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

/** Item fields accepted when adding items (no checked/position — new items start unchecked). */
const addItemSchema = createShoppingListItemSchema.pick({
  name: true,
  category: true,
  quantity: true,
  unit: true,
  notes: true,
});

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
        'rather than creating duplicates.',
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

      const results = await addOrMergeItems(
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
        'off, checked=false to uncheck. Only provided fields change.',
      inputSchema: {
        listId: idSchema,
        itemId: idSchema.describe('Item id (from get_shopping_list)'),
        ...updateShoppingListItemSchema.shape,
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

  return server;
}
