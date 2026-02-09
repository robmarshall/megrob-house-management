-- Add indexes for frequently queried columns to improve query performance

-- Recipe indexes
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON recipes(created_by);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_updated_at ON recipes(updated_at DESC);

-- Shopping list indexes
CREATE INDEX IF NOT EXISTS idx_shopping_lists_created_by ON shopping_lists(created_by);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list_id ON shopping_list_items(list_id);

-- Recipe category indexes (for filtering by meal_type, dietary, allergen)
CREATE INDEX IF NOT EXISTS idx_recipe_categories_recipe_id ON recipe_categories(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_categories_type_value ON recipe_categories(category_type, category_value);

-- Recipe ingredients indexes (for search)
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_name ON recipe_ingredients(name);

-- User favorites indexes
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_recipe_id ON user_favorites(recipe_id);

-- Recipe feedback indexes
CREATE INDEX IF NOT EXISTS idx_recipe_feedback_recipe_id ON recipe_feedback(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_feedback_user_id ON recipe_feedback(user_id);

-- Add unique constraint to prevent duplicate feedback per user per recipe
-- First drop any existing duplicates if they exist (keeps the most recent one)
DELETE FROM recipe_feedback a USING recipe_feedback b
WHERE a.id < b.id
  AND a.recipe_id = b.recipe_id
  AND a.user_id = b.user_id;

-- Then add the unique constraint
ALTER TABLE recipe_feedback
ADD CONSTRAINT unique_user_recipe_feedback
UNIQUE (recipe_id, user_id);
