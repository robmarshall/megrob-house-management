import {
  eq,
  desc,
  asc,
  or,
  inArray,
  and,
  sql,
  ilike,
  exists,
  notExists,
  SQL,
  isNull,
} from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  recipes,
  recipeIngredients,
  recipeCategories,
  userFavorites,
} from '../db/schema.js';
import { getUserHouseholdId } from '../lib/household.js';
import { replaceRecipeRelations } from './recipeRelations.js';
import type {
  RecipeIngredientInput,
  RecipeCategoryInput,
} from './recipeRelations.js';

type RecipeRow = typeof recipes.$inferSelect;
type RecipeCategoryRow = typeof recipeCategories.$inferSelect;
type RecipeIngredientRow = typeof recipeIngredients.$inferSelect;

/**
 * Verify recipe access (household or personal ownership).
 * Returns the recipe if the user has access, null otherwise.
 */
export async function verifyRecipeAccess(
  recipeId: number,
  userId: string
): Promise<RecipeRow | null> {
  const householdId = await getUserHouseholdId(userId);

  let accessFilter: SQL;
  if (householdId) {
    accessFilter = or(
      eq(recipes.householdId, householdId),
      and(eq(recipes.createdBy, userId), isNull(recipes.householdId))
    )!;
  } else {
    accessFilter = eq(recipes.createdBy, userId);
  }

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), accessFilter));

  return recipe ?? null;
}

export interface SearchRecipesOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  favorite?: boolean;
  /** Recipe status filter; defaults to 'ready'. Pass 'all' to disable. */
  status?: string;
  mealTypes?: string[];
  dietary?: string[];
  allergenFree?: string[];
  cuisine?: string;
  difficulty?: string;
}

export interface SearchRecipesResult {
  data: (RecipeRow & { isFavorite: boolean; categories: RecipeCategoryRow[] })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Paginated recipe search scoped to the user's household (or personal recipes
 * when they have no household). Shared by the REST route and the MCP tool.
 */
export async function searchRecipes(
  userId: string,
  options: SearchRecipesOptions = {}
): Promise<SearchRecipesResult> {
  const {
    page = 1,
    pageSize = 20,
    search,
    favorite,
    status,
    mealTypes,
    dietary,
    allergenFree,
    cuisine,
    difficulty,
  } = options;
  const offset = (page - 1) * pageSize;

  const householdId = await getUserHouseholdId(userId);

  const conditions: SQL[] = [];

  // Scope to household (or personal recipes if no household)
  if (householdId) {
    conditions.push(
      or(
        eq(recipes.householdId, householdId),
        and(eq(recipes.createdBy, userId), isNull(recipes.householdId))
      )!
    );
  } else {
    conditions.push(eq(recipes.createdBy, userId));
  }

  // Status filter (default to 'ready' if not specified)
  if (!status) {
    conditions.push(eq(recipes.status, 'ready'));
  } else if (status !== 'all') {
    conditions.push(eq(recipes.status, status));
  }

  if (cuisine) {
    conditions.push(ilike(recipes.cuisine, cuisine));
  }

  if (difficulty) {
    conditions.push(ilike(recipes.difficulty, difficulty));
  }

  // Search filter (name, description, or ingredient name)
  if (search) {
    const searchPattern = `%${search}%`;
    const ingredientSearchSubquery = db
      .select({ recipeId: recipeIngredients.recipeId })
      .from(recipeIngredients)
      .where(
        and(
          eq(recipeIngredients.recipeId, recipes.id),
          ilike(recipeIngredients.name, searchPattern)
        )
      );

    conditions.push(
      or(
        ilike(recipes.name, searchPattern),
        ilike(recipes.description, searchPattern),
        exists(ingredientSearchSubquery)
      )!
    );
  }

  // Favorites filter (per-user)
  if (favorite) {
    const favoritesSubquery = db
      .select({ recipeId: userFavorites.recipeId })
      .from(userFavorites)
      .where(
        and(
          eq(userFavorites.recipeId, recipes.id),
          eq(userFavorites.userId, userId)
        )
      );
    conditions.push(exists(favoritesSubquery));
  }

  // Meal type filter (any of the specified types)
  if (mealTypes && mealTypes.length > 0) {
    const normalized = mealTypes.map((t) => t.trim().toLowerCase());
    const mealTypeSubquery = db
      .select({ recipeId: recipeCategories.recipeId })
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.recipeId, recipes.id),
          eq(recipeCategories.categoryType, 'meal_type'),
          inArray(sql`LOWER(${recipeCategories.categoryValue})`, normalized)
        )
      );
    conditions.push(exists(mealTypeSubquery));
  }

  // Dietary filter (must have ALL specified dietary options)
  if (dietary && dietary.length > 0) {
    for (const diet of dietary.map((d) => d.trim().toLowerCase())) {
      const dietarySubquery = db
        .select({ recipeId: recipeCategories.recipeId })
        .from(recipeCategories)
        .where(
          and(
            eq(recipeCategories.recipeId, recipes.id),
            eq(recipeCategories.categoryType, 'dietary'),
            ilike(recipeCategories.categoryValue, diet)
          )
        );
      conditions.push(exists(dietarySubquery));
    }
  }

  // Allergen-free filter (must NOT have any of the specified allergens)
  if (allergenFree && allergenFree.length > 0) {
    const allergensToExclude = allergenFree.map((a) => a.trim().toLowerCase());
    const allergenSubquery = db
      .select({ recipeId: recipeCategories.recipeId })
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.recipeId, recipes.id),
          eq(recipeCategories.categoryType, 'allergen'),
          inArray(sql`LOWER(${recipeCategories.categoryValue})`, allergensToExclude)
        )
      );
    conditions.push(notExists(allergenSubquery));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes)
    .where(whereClause);
  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / pageSize);

  const data = await db
    .select()
    .from(recipes)
    .where(whereClause)
    .orderBy(desc(recipes.updatedAt))
    .limit(pageSize)
    .offset(offset);

  if (data.length === 0) {
    return { data: [], total, page, pageSize, totalPages };
  }

  // Per-user favorite status + categories for the returned page only
  const recipeIds = data.map((r) => r.id);
  const userFavoritesList = await db
    .select({ recipeId: userFavorites.recipeId })
    .from(userFavorites)
    .where(
      and(
        eq(userFavorites.userId, userId),
        inArray(userFavorites.recipeId, recipeIds)
      )
    );
  const userFavoriteIds = new Set(userFavoritesList.map((f) => f.recipeId));

  const categoriesForRecipes = await db
    .select()
    .from(recipeCategories)
    .where(inArray(recipeCategories.recipeId, recipeIds));

  const categoriesByRecipe = new Map<number, RecipeCategoryRow[]>();
  for (const cat of categoriesForRecipes) {
    if (!categoriesByRecipe.has(cat.recipeId)) {
      categoriesByRecipe.set(cat.recipeId, []);
    }
    categoriesByRecipe.get(cat.recipeId)!.push(cat);
  }

  const dataWithCategories = data.map((recipe) => ({
    ...recipe,
    isFavorite: userFavoriteIds.has(recipe.id),
    categories: categoriesByRecipe.get(recipe.id) || [],
  }));

  return { data: dataWithCategories, total, page, pageSize, totalPages };
}

export interface RecipeDetail extends RecipeRow {
  isFavorite: boolean;
  ingredients: RecipeIngredientRow[];
  categories: RecipeCategoryRow[];
}

/**
 * One recipe with ingredients + categories, or null when it doesn't exist or
 * the user can't see it.
 */
export async function getRecipeDetail(
  userId: string,
  recipeId: number
): Promise<RecipeDetail | null> {
  const recipe = await verifyRecipeAccess(recipeId, userId);
  if (!recipe) return null;

  const [userFavorite] = await db
    .select()
    .from(userFavorites)
    .where(
      and(eq(userFavorites.userId, userId), eq(userFavorites.recipeId, recipeId))
    );

  const ingredients = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.position));

  const categories = await db
    .select()
    .from(recipeCategories)
    .where(eq(recipeCategories.recipeId, recipeId));

  return { ...recipe, isFavorite: !!userFavorite, ingredients, categories };
}

export interface CreateRecipeServiceInput {
  name: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  instructions: string | string[];
  difficulty?: string;
  cuisine?: string;
  notes?: string;
  ingredients?: RecipeIngredientInput[];
  categories?: RecipeCategoryInput[];
}

/**
 * Create a recipe (with child rows) atomically, scoped to the user's household.
 */
export async function createRecipe(
  userId: string,
  input: CreateRecipeServiceInput
): Promise<RecipeRow> {
  const {
    name,
    description,
    servings,
    prepTimeMinutes,
    cookTimeMinutes,
    instructions,
    difficulty,
    cuisine,
    notes,
    ingredients,
    categories,
  } = input;

  const householdId = await getUserHouseholdId(userId);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(recipes)
      .values({
        name,
        description: description || null,
        householdId,
        servings: servings || 4,
        prepTimeMinutes: prepTimeMinutes || null,
        cookTimeMinutes: cookTimeMinutes || null,
        instructions:
          typeof instructions === 'string'
            ? instructions
            : JSON.stringify(instructions),
        difficulty: difficulty || null,
        cuisine: cuisine || null,
        notes: notes || null,
        status: 'ready',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await replaceRecipeRelations(tx, created.id, { ingredients, categories });

    return created;
  });
}

export interface UpdateRecipeServiceInput
  extends Partial<CreateRecipeServiceInput> {
  rating?: number;
}

/**
 * Partial update of a recipe (with optional child-row replacement) atomically.
 * Shared-edit policy: any user with access may edit (see routes/recipes.ts).
 * Returns null when the recipe doesn't exist or the user can't see it.
 */
export async function updateRecipe(
  userId: string,
  recipeId: number,
  input: UpdateRecipeServiceInput
): Promise<RecipeRow | null> {
  const existingRecipe = await verifyRecipeAccess(recipeId, userId);
  if (!existingRecipe) return null;

  const {
    name,
    description,
    servings,
    prepTimeMinutes,
    cookTimeMinutes,
    instructions,
    difficulty,
    cuisine,
    notes,
    rating,
    ingredients,
    categories,
  } = input;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(recipes)
      .set({
        name: name !== undefined ? name : existingRecipe.name,
        description:
          description !== undefined ? description : existingRecipe.description,
        servings: servings !== undefined ? servings : existingRecipe.servings,
        prepTimeMinutes:
          prepTimeMinutes !== undefined
            ? prepTimeMinutes
            : existingRecipe.prepTimeMinutes,
        cookTimeMinutes:
          cookTimeMinutes !== undefined
            ? cookTimeMinutes
            : existingRecipe.cookTimeMinutes,
        instructions:
          instructions !== undefined
            ? typeof instructions === 'string'
              ? instructions
              : JSON.stringify(instructions)
            : existingRecipe.instructions,
        difficulty:
          difficulty !== undefined ? difficulty : existingRecipe.difficulty,
        cuisine: cuisine !== undefined ? cuisine : existingRecipe.cuisine,
        notes: notes !== undefined ? notes : existingRecipe.notes,
        rating: rating !== undefined ? rating : existingRecipe.rating,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, recipeId))
      .returning();

    await replaceRecipeRelations(tx, recipeId, { ingredients, categories });

    return updated;
  });
}
