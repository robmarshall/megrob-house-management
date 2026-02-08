import { pgTable, serial, text, timestamp, integer, numeric, boolean } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

// Re-export auth schema tables
export * from './auth-schema';

// Database schema definitions

/**
 * Shopping Lists Table
 * Stores user's shopping lists with metadata
 */
export const shoppingLists = pgTable('shopping_lists', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // Changed from uuid to text to match Better Auth user IDs
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => user.id),
});

/**
 * Shopping List Items Table
 * Stores individual items within shopping lists
 */
export const shoppingListItems = pgTable('shopping_list_items', {
  id: serial('id').primaryKey(),
  listId: integer('list_id')
    .notNull()
    .references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category'), // e.g., "produce", "dairy", "hardware"
  quantity: numeric('quantity').default('1'),
  unit: text('unit'), // e.g., "lbs", "oz", "items"
  notes: text('notes'),
  checked: boolean('checked').default(false).notNull(),
  checkedAt: timestamp('checked_at'),
  // Changed from uuid to text to match Better Auth user IDs
  checkedBy: text('checked_by').references(() => user.id),
  position: integer('position').default(0).notNull(), // for custom ordering
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => user.id),
});

/**
 * Recipes Table
 * Stores user's recipes with metadata (shared household model)
 */
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => user.id),
});

/**
 * Recipe Ingredients Table
 * Stores parsed ingredients for each recipe
 */
export const recipeIngredients = pgTable('recipe_ingredients', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: numeric('quantity'),
  unit: text('unit'),
  notes: text('notes'), // e.g., "finely chopped"
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Recipe Categories Table
 * Stores category tags for recipes (meal type, dietary, allergens)
 */
export const recipeCategories = pgTable('recipe_categories', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  categoryType: text('category_type').notNull(), // 'meal_type' | 'dietary' | 'allergen'
  categoryValue: text('category_value').notNull(), // e.g., 'vegetarian', 'contains_nuts'
});

/**
 * Recipe Feedback Table
 * Stores user feedback (like/dislike with notes) for iterative recipe improvement
 */
export const recipeFeedback = pgTable('recipe_feedback', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  isLike: boolean('is_like').notNull(), // true = like, false = dislike
  note: text('note'), // Optional explanation for the feedback
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * User Favorites Table
 * Stores per-user recipe favorites (many-to-many relationship)
 */
export const userFavorites = pgTable('user_favorites', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
