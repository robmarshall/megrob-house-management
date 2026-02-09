import { z } from 'zod';

/**
 * Shared validation schemas for backend API endpoints
 */

// Shopping List schemas
export const createShoppingListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
});

export const updateShoppingListSchema = createShoppingListSchema.partial();

// Shopping List Item schemas
export const createShoppingListItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  category: z.string().max(50).optional(),
  quantity: z.number().positive('Quantity must be positive').optional().default(1),
  unit: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
  checked: z.boolean().optional().default(false),
  position: z.number().int().nonnegative().optional(),
});

export const updateShoppingListItemSchema = createShoppingListItemSchema.partial();

// Recipe Ingredient schema (for nested validation)
const recipeIngredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required').max(200),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  notes: z.string().max(200).optional(),
});

// Recipe Category schema (for nested validation)
const recipeCategorySchema = z.object({
  type: z.string().min(1).max(50),
  value: z.string().min(1).max(100),
});

// Recipe schemas
export const createRecipeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  description: z.string().max(1000).optional(),
  servings: z.number().int().positive().max(100).optional().default(4),
  prepTimeMinutes: z.number().int().nonnegative().max(1440).optional(), // Max 24 hours
  cookTimeMinutes: z.number().int().nonnegative().max(1440).optional(),
  instructions: z.union([
    z.string().min(1, 'Instructions are required'),
    z.array(z.string()),
  ]),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cuisine: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  ingredients: z.array(recipeIngredientSchema).optional(),
  categories: z.array(recipeCategorySchema).optional(),
});

export const updateRecipeSchema = createRecipeSchema.partial().extend({
  rating: z.number().int().min(1).max(5).optional(),
});

// Recipe Import schema
export const importRecipeSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

// Recipe Feedback schema
export const createFeedbackSchema = z.object({
  isLike: z.boolean(),
  note: z.string().max(1000).optional(),
});

// Add to Shopping List schema
export const addToShoppingListSchema = z.object({
  shoppingListId: z.number().int().positive().optional(),
  newListName: z.string().min(1).max(100).optional(),
  ingredientIds: z.array(z.number().int().positive()).min(1, 'At least one ingredient is required'),
  servingMultiplier: z.number().positive().max(10).optional().default(1),
}).refine(
  (data) => data.shoppingListId || data.newListName,
  { message: 'Either shoppingListId or newListName is required' }
);

// Household schemas
export const createHouseholdSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email format'),
});

// Meal Plan schemas
export const createMealPlanSchema = z.object({
  name: z.string().max(200).optional(),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

export const updateMealPlanSchema = z.object({
  name: z.string().max(200).optional(),
});

export const createMealPlanEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  recipeId: z.number().int().positive().optional(),
  customText: z.string().max(200).optional(),
  position: z.number().int().nonnegative().optional(),
}).refine(
  (data) => data.recipeId || data.customText,
  { message: 'Either recipeId or customText is required' }
);

export const updateMealPlanEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  recipeId: z.number().int().positive().nullable().optional(),
  customText: z.string().max(200).nullable().optional(),
  position: z.number().int().nonnegative().optional(),
});

export const copyMealPlanSchema = z.object({
  sourceWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  targetWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

export const mealPlanToShoppingListSchema = z.object({
  shoppingListId: z.number().int().positive().optional(),
  newListName: z.string().min(1).max(100).optional(),
}).refine(
  (data) => data.shoppingListId || data.newListName,
  { message: 'Either shoppingListId or newListName is required' }
);

// Type exports for use in route handlers
export type CreateShoppingListInput = z.infer<typeof createShoppingListSchema>;
export type UpdateShoppingListInput = z.infer<typeof updateShoppingListSchema>;
export type CreateShoppingListItemInput = z.infer<typeof createShoppingListItemSchema>;
export type UpdateShoppingListItemInput = z.infer<typeof updateShoppingListItemSchema>;
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type ImportRecipeInput = z.infer<typeof importRecipeSchema>;
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type AddToShoppingListInput = z.infer<typeof addToShoppingListSchema>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;
export type CreateMealPlanEntryInput = z.infer<typeof createMealPlanEntrySchema>;
export type UpdateMealPlanEntryInput = z.infer<typeof updateMealPlanEntrySchema>;
export type CopyMealPlanInput = z.infer<typeof copyMealPlanSchema>;
export type MealPlanToShoppingListInput = z.infer<typeof mealPlanToShoppingListSchema>;
