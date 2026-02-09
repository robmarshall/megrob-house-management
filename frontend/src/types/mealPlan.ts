/**
 * Meal Plan TypeScript Interfaces
 * These types match the backend database schema
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface MealPlanEntry {
  id: number;
  mealPlanId: number;
  dayOfWeek: number; // 0-6 (Mon-Sun)
  mealType: MealType;
  recipeId?: number | null;
  recipeName?: string | null;
  recipeImageUrl?: string | null;
  customText?: string | null;
  position: number;
  createdAt: string;
}

export interface MealPlan {
  id: number;
  name?: string | null;
  weekStartDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  entries: MealPlanEntry[];
}

export interface CreateMealPlanInput {
  name?: string;
  weekStartDate: string;
}

export interface UpdateMealPlanInput {
  name?: string;
}

export interface CreateMealPlanEntryInput {
  dayOfWeek: number;
  mealType: MealType;
  recipeId?: number;
  customText?: string;
  position?: number;
}

export interface UpdateMealPlanEntryInput {
  dayOfWeek?: number;
  mealType?: MealType;
  recipeId?: number | null;
  customText?: string | null;
  position?: number;
}

export interface CopyMealPlanInput {
  sourceWeek: string;
  targetWeek: string;
}

export interface MealPlanToShoppingListInput {
  shoppingListId?: number;
  newListName?: string;
}
