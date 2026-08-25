import { pgTable, serial, bigserial, text, timestamp, integer, numeric, boolean, unique, uniqueIndex, index, primaryKey, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth-schema';

// Re-export auth schema tables
export * from './auth-schema';

// Database schema definitions

/**
 * Households Table
 * Groups users into a shared household for collaborative data access
 */
export const households = pgTable('households', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Household Members Table
 * Tracks which users belong to which household (one household per user)
 */
export const householdMembers = pgTable('household_members', {
  id: serial('id').primaryKey(),
  householdId: integer('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // 'owner' | 'member'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  unique('household_members_user_unique').on(table.userId),
]);

/**
 * Household Invitations Table
 * Pending invitations for users to join a household
 */
export const householdInvitations = pgTable('household_invitations', {
  id: serial('id').primaryKey(),
  householdId: integer('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => user.id),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'declined'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

/**
 * Shopping Lists Table
 * Stores household shopping lists with metadata
 */
export const shoppingLists = pgTable('shopping_lists', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  householdId: integer('household_id')
    .references(() => households.id, { onDelete: 'cascade' }),
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
  householdId: integer('household_id')
    .references(() => households.id, { onDelete: 'cascade' }),
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
  imageUrl: text('image_url'), // Recipe image URL (scraped from og:image or recipe structured data)
  isPublic: boolean('is_public').default(false).notNull(), // Recipe visible via public share link
  publicId: text('public_id').unique(), // Unguessable UUID for the public share URL; generated on first share
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
}, (table) => [
  // Prevent duplicate category entries per recipe (migration 0004).
  unique('unique_recipe_category').on(table.recipeId, table.categoryType, table.categoryValue),
]);

/**
 * Recipe Nutrition Table
 * Per-serving nutrition computed asynchronously by the nutrition-enrich
 * worker job from the recipe's ingredients. One row per recipe.
 */
export const recipeNutrition = pgTable('recipe_nutrition', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  status: text('status').default('pending').notNull(), // 'pending' | 'ready' | 'failed'
  // All values per serving
  caloriesKcal: numeric('calories_kcal'),
  proteinG: numeric('protein_g'),
  carbsG: numeric('carbs_g'),
  fatG: numeric('fat_g'),
  fiberG: numeric('fiber_g'),
  sugarG: numeric('sugar_g'),
  saltG: numeric('salt_g'),
  estimated: boolean('estimated').default(false).notNull(), // any LLM-estimated component
  matchedCount: integer('matched_count').default(0).notNull(), // ingredients resolved
  totalCount: integer('total_count').default(0).notNull(), // ingredients total
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  unique('recipe_nutrition_recipe_unique').on(table.recipeId),
]);

/**
 * Ingredient Food Cache Table
 * Resolved nutrition facts per normalized ingredient name + unit, shared
 * across all households (food facts are not user data). Each distinct
 * ingredient string is resolved (Open Food Facts or LLM) at most once.
 */
export const ingredientFoodCache = pgTable('ingredient_food_cache', {
  id: serial('id').primaryKey(),
  normalizedName: text('normalized_name').notNull(),
  // Canonical unit context: 'g' for all mass units, else the canonical
  // unit ('cups', 'tbsp', 'item', ...) since grams-per-unit depends on it
  unit: text('unit').notNull(),
  source: text('source').notNull(), // 'off' | 'llm'
  gramsPerUnit: numeric('grams_per_unit').notNull(),
  // Per 100 g of the food
  caloriesPer100g: numeric('calories_per_100g'),
  proteinPer100g: numeric('protein_per_100g'),
  carbsPer100g: numeric('carbs_per_100g'),
  fatPer100g: numeric('fat_per_100g'),
  fiberPer100g: numeric('fiber_per_100g'),
  sugarPer100g: numeric('sugar_per_100g'),
  saltPer100g: numeric('salt_per_100g'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('ingredient_food_cache_name_unit_unique').on(
    table.normalizedName,
    table.unit
  ),
]);

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
}, (table) => [
  // One feedback row per user per recipe (migration 0003).
  unique('unique_user_recipe_feedback').on(table.recipeId, table.userId),
]);

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
}, (table) => [
  // Prevent duplicate favorites (migration 0002, unique index).
  uniqueIndex('user_favorites_user_recipe_unique').on(table.userId, table.recipeId),
]);

/**
 * Item Category Memory Table
 * Learned "item name -> shopping category" preferences, scoped to a household
 * (or to a single user when they have no household). Written when a user
 * explicitly picks or corrects an item's category; read to auto-categorize
 * future adds before falling back to the built-in keyword dictionary.
 */
export const itemCategoryMemory = pgTable('item_category_memory', {
  id: serial('id').primaryKey(),
  householdId: integer('household_id')
    .references(() => households.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  normalizedName: text('normalized_name').notNull(), // via normalizeItemName()
  category: text('category').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // One entry per name per household, or per user for personal (no-household)
  // scope — same partial-index pattern as meal_plans.
  uniqueIndex('idx_item_category_memory_household')
    .on(table.householdId, table.normalizedName)
    .where(sql`${table.householdId} is not null`),
  uniqueIndex('idx_item_category_memory_user')
    .on(table.userId, table.normalizedName)
    .where(sql`${table.householdId} is null`),
]);

/**
 * Nutrition Profiles Table
 * Per-user body metrics + activity/goal used to compute daily nutrition
 * targets. Raw fields (height/weight/DOB/sex) are private to the owning
 * user — household members only ever see derived targets
 * (see nutritionProfileService).
 */
export const nutritionProfiles = pgTable('nutrition_profiles', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  heightCm: integer('height_cm'),
  weightKg: numeric('weight_kg'),
  dateOfBirth: date('date_of_birth'),
  sex: text('sex'), // 'male' | 'female' — only used as BMR formula input
  activityLevel: text('activity_level'), // 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goal: text('goal').default('maintain').notNull(), // 'lose' | 'maintain' | 'gain'
  // Manual per-field overrides; take precedence over formula-derived values
  overrideCaloriesKcal: integer('override_calories_kcal'),
  overrideProteinG: integer('override_protein_g'),
  overrideCarbsG: integer('override_carbs_g'),
  overrideFatG: integer('override_fat_g'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  unique('nutrition_profiles_user_unique').on(table.userId),
]);

/**
 * Meal Plans Table
 * Weekly meal plans scoped to household or personal
 */
export const mealPlans = pgTable('meal_plans', {
  id: serial('id').primaryKey(),
  name: text('name'),
  weekStartDate: date('week_start_date').notNull(),
  householdId: integer('household_id')
    .references(() => households.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => user.id),
}, (table) => [
  // One plan per week per user (personal) or per household (migration 0008,
  // partial unique indexes split on whether the plan is household-scoped).
  uniqueIndex('idx_meal_plans_week_user')
    .on(table.weekStartDate, table.createdBy)
    .where(sql`${table.householdId} is null`),
  uniqueIndex('idx_meal_plans_week_household')
    .on(table.weekStartDate, table.householdId)
    .where(sql`${table.householdId} is not null`),
]);

/**
 * Meal Plan Entries Table
 * Individual meal slots within a meal plan
 */
export const mealPlanEntries = pgTable('meal_plan_entries', {
  id: serial('id').primaryKey(),
  mealPlanId: integer('meal_plan_id')
    .notNull()
    .references(() => mealPlans.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Monday, 6=Sunday
  mealType: text('meal_type').notNull(), // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId: integer('recipe_id')
    .references(() => recipes.id, { onDelete: 'set null' }),
  customText: text('custom_text'),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/* Snozone availability collector                                             */
/*                                                                            */
/* Longitudinal record of slot availability at the Snozone slope, polled every */
/* 30 minutes. Its purpose is to answer two questions a single snapshot cannot: */
/* when people book, and which days and times are busy across a season.        */
/*                                                                            */
/* The data is NOT backfillable — Snozone exposes no history — so these tables */
/* are append-mostly and the raw observations are never rewritten. Everything  */
/* else is derivable from them.                                                */
/* -------------------------------------------------------------------------- */

/**
 * Snozone Products Table
 * What to poll. A row rather than config so a second product or location is an
 * insert, not a migration. `active` is the kill switch.
 */
export const snozoneProducts = pgTable('snozone_products', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  locationId: integer('location_id').notNull(),
  categoryId: integer('category_id').notNull(),
  productId: integer('product_id').notNull(),
  qty: integer('qty').notNull().default(1),
  // urlencoded body POSTed to buildSessionGroup.php to select the product.
  primeBody: text('prime_body').notNull(),
  sessionMinutes: integer('session_minutes').notNull().default(60),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('snozone_products_unique').on(table.locationId, table.productId, table.qty),
]);

/**
 * Snozone Poll Runs Table
 * One row per scheduled collection run.
 *
 * This table is what makes "unchanged" distinguishable from "not observed",
 * which is the entire basis of the diff analysis: observations are written only
 * on change, so without a record of when we looked, a gap is ambiguous.
 */
export const snozonePollRuns = pgTable('snozone_poll_runs', {
  id: serial('id').primaryKey(),
  productRowId: integer('product_row_id')
    .notNull()
    .references(() => snozoneProducts.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(), // 'window' | 'horizon'
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  // 'running' | 'ok' | 'blocked' | 'unprimed' | 'error'
  status: text('status').notNull().default('running'),
  datesPolled: text('dates_polled').array(),
  datesSkipped: text('dates_skipped').array(),
  horizonLength: integer('horizon_length'),
  slotsSeen: integer('slots_seen'),
  changesWritten: integer('changes_written'),
  httpCalls: integer('http_calls'),
  error: text('error'),
}, (table) => [
  index('snozone_poll_runs_started_idx').on(table.startedAt),
]);

/**
 * Snozone Slot Observations Table
 * The raw record. Written ONLY when a tracked value changed since the previous
 * observation of that (product, session_date, slot_time).
 *
 * `prevSeenAt` is the load-bearing column. With change-only storage the previous
 * stored row may be hours old, which would smear a booking across a wide window;
 * this records the last run that actually polled the slot and saw no change,
 * pinning every observed change to a <=30 minute bracket.
 *
 * Note `slotTime` is venue-local 'HH:MM' text and `sessionDate` a plain date:
 * they are deliberately NOT collapsed into a UTC instant, so BST cannot corrupt
 * the time-of-day analysis.
 */
export const snozoneSlotObservations = pgTable('snozone_slot_observations', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  runId: integer('run_id')
    .notNull()
    .references(() => snozonePollRuns.id),
  productRowId: integer('product_row_id')
    .notNull()
    .references(() => snozoneProducts.id, { onDelete: 'cascade' }),
  sessionDate: date('session_date').notNull(),
  slotTime: text('slot_time').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  prevSeenAt: timestamp('prev_seen_at', { withTimezone: true }),
  // totalPeopleInSession: sessions STARTING here. Diffing this is the booking
  // signal; one booking also bumps from_prior on the next twelve slots, so
  // diffing on_slope counts each booking thirteen times.
  starting: integer('starting').notNull(),
  fromPrior: integer('from_prior').notNull(),
  // starting + from_prior: headcount on the slope. The busyness signal.
  onSlope: integer('on_slope').notNull(),
  qtyAvailable: integer('qty_available').notNull(),
  totalQty: integer('total_qty').notNull(),
  available: boolean('available').notNull(),
  soldOut: boolean('sold_out').notNull(),
  blocked: boolean('blocked').notNull(),
  lowAvailability: boolean('low_availability').notNull(),
  callToBook: boolean('call_to_book').notNull(),
  reason: text('reason'),
  price: numeric('price', { precision: 8, scale: 2 }),
  slotType: text('slot_type'),
  experience: text('experience'),
  // Was the slot already past its start time when observed? Such readings are
  // corrupted (qty_available zeroed, from_prior not decrementing) and must be
  // excluded from every occupancy figure.
  expiredWhenSeen: boolean('expired_when_seen').notNull().default(false),
}, (table) => [
  index('snozone_obs_slot_idx').on(
    table.productRowId, table.sessionDate, table.slotTime, table.observedAt
  ),
  index('snozone_obs_observed_idx').on(table.observedAt),
]);

/**
 * Snozone Slot Finals Table
 * The last trustworthy reading per slot per past date, recomputed nightly.
 *
 * Small (121 slots x 365 days is ~44k rows/year) and immune to the expiry
 * corruption, so it is the base table for all day-of-week and seasonal
 * analytics. Always rederivable from the observations.
 */
export const snozoneSlotFinals = pgTable('snozone_slot_finals', {
  productRowId: integer('product_row_id')
    .notNull()
    .references(() => snozoneProducts.id, { onDelete: 'cascade' }),
  sessionDate: date('session_date').notNull(),
  slotTime: text('slot_time').notNull(),
  finalOnSlope: integer('final_on_slope').notNull(),
  finalStarting: integer('final_starting').notNull(),
  totalQty: integer('total_qty').notNull(),
  peakOnSlope: integer('peak_on_slope').notNull(),
  // Occupancy already present the first time this date was ever observed, i.e.
  // bookings made before it entered our polling horizon. Makes the truncation
  // measurable instead of invisible.
  firstSeenOnSlope: integer('first_seen_on_slope').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
  slotType: text('slot_type'),
  price: numeric('price', { precision: 8, scale: 2 }),
  observationCount: integer('observation_count').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.productRowId, table.sessionDate, table.slotTime] }),
]);
