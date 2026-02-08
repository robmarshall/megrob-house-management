-- Add unique constraint on recipe_categories to prevent duplicate category entries
-- This prevents race conditions in delete-then-reinsert logic

-- First remove any existing duplicates (keeps the one with the lowest id)
DELETE FROM recipe_categories a USING recipe_categories b
WHERE a.id > b.id
  AND a.recipe_id = b.recipe_id
  AND a.category_type = b.category_type
  AND a.category_value = b.category_value;

-- Add the unique constraint
ALTER TABLE recipe_categories
ADD CONSTRAINT unique_recipe_category
UNIQUE (recipe_id, category_type, category_value);
