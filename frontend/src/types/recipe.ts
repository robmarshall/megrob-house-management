/**
 * Recipe TypeScript Interfaces
 * These types match the backend database schema
 */

/**
 * Recipe status for import workflow
 */
export type RecipeStatus = 'pending' | 'ready' | 'failed';

/**
 * Recipe difficulty levels
 */
export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Category types for recipes
 */
export type RecipeCategoryType = 'meal_type' | 'dietary' | 'allergen';

/**
 * Recipe
 * Represents a full recipe with metadata
 */
export interface Recipe {
  id: number;
  name: string;
  description?: string | null;
  servings: number;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  instructions: string; // JSON array of steps
  sourceUrl?: string | null;
  status: RecipeStatus;
  errorMessage?: string | null;
  difficulty?: RecipeDifficulty | null;
  cuisine?: string | null;
  notes?: string | null;
  rating?: number | null; // 1-5
  isFavorite?: boolean; // Computed per-user from userFavorites, not stored on recipe
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  // Included when fetching single recipe
  ingredients?: RecipeIngredient[];
  categories?: RecipeCategory[];
}

/**
 * Recipe Ingredient
 * Represents a parsed ingredient with quantity and unit
 */
export interface RecipeIngredient {
  id: number;
  recipeId: number;
  name: string;
  quantity?: string | null; // Stored as numeric, returned as string
  unit?: string | null;
  notes?: string | null; // e.g., "finely chopped"
  position: number;
  createdAt: string;
}

/**
 * Recipe Category
 * Represents a category tag (meal type, dietary, allergen)
 */
export interface RecipeCategory {
  id: number;
  recipeId: number;
  categoryType: RecipeCategoryType;
  categoryValue: string;
}

/**
 * Input types for creating recipes
 */
export interface CreateRecipeInput {
  name: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  instructions: string | string[];
  difficulty?: RecipeDifficulty;
  cuisine?: string;
  notes?: string;
  ingredients?: CreateRecipeIngredientInput[];
  categories?: CreateRecipeCategoryInput[];
}

/**
 * Input types for updating recipes
 */
export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  instructions?: string | string[];
  difficulty?: RecipeDifficulty;
  cuisine?: string;
  notes?: string;
  rating?: number;
  ingredients?: CreateRecipeIngredientInput[];
  categories?: CreateRecipeCategoryInput[];
}

/**
 * Input for creating recipe ingredients
 */
export interface CreateRecipeIngredientInput {
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

/**
 * Input for creating recipe categories
 */
export interface CreateRecipeCategoryInput {
  type: RecipeCategoryType;
  value: string;
}

/**
 * Import recipe by URL input
 */
export interface ImportRecipeInput {
  url: string;
}

/**
 * Predefined category values
 */
export const MEAL_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'starter',
  'main',
  'side',
  'dessert',
  'snack',
] as const;

export const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'gluten_free',
  'dairy_free',
  'keto',
  'paleo',
] as const;

export const ALLERGENS = [
  'nuts',
  'eggs',
  'dairy',
  'gluten',
  'shellfish',
  'soy',
  'fish',
] as const;

export type MealType = typeof MEAL_TYPES[number];
export type DietaryOption = typeof DIETARY_OPTIONS[number];
export type Allergen = typeof ALLERGENS[number];

/**
 * Recipe Feedback
 * Represents a single like/dislike entry with optional note
 */
export interface RecipeFeedback {
  id: number;
  recipeId: number;
  userId: string;
  userName: string | null;
  isLike: boolean;
  note: string | null;
  createdAt: string;
}

/**
 * Recipe Feedback Summary
 * Contains counts and list of feedback entries
 */
export interface RecipeFeedbackSummary {
  likes: number;
  dislikes: number;
  entries: RecipeFeedback[];
}

/**
 * Input for adding feedback
 */
export interface AddFeedbackInput {
  isLike: boolean;
  note?: string;
}

/**
 * Helper to get display label for category values
 */
export const categoryLabels: Record<string, string> = {
  // Meal types
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  starter: 'Starter',
  main: 'Main Course',
  side: 'Side Dish',
  dessert: 'Dessert',
  snack: 'Snack',
  // Dietary
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  gluten_free: 'Gluten-Free',
  dairy_free: 'Dairy-Free',
  keto: 'Keto',
  paleo: 'Paleo',
  // Allergens
  nuts: 'Nuts',
  eggs: 'Eggs',
  dairy: 'Dairy',
  gluten: 'Gluten',
  shellfish: 'Shellfish',
  soy: 'Soy',
  fish: 'Fish',
};
