-- Introduce the free-text 'tag' category type. Meal types outside the fixed
-- list (e.g. "Camping", added via MCP) were stored as meal_type, where no
-- filter could reach them; move them to 'tag'.

-- Drop any that would collide with an identical tag already on the recipe.
DELETE FROM recipe_categories a USING recipe_categories b
WHERE a.category_type = 'meal_type'
  AND LOWER(TRIM(a.category_value)) NOT IN ('breakfast', 'lunch', 'dinner', 'starter', 'main', 'side', 'dessert', 'snack')
  AND b.recipe_id = a.recipe_id
  AND b.category_type = 'tag'
  AND LOWER(b.category_value) = LOWER(TRIM(a.category_value));
--> statement-breakpoint
UPDATE recipe_categories
SET category_type = 'tag', category_value = TRIM(category_value)
WHERE category_type = 'meal_type'
  AND LOWER(TRIM(category_value)) NOT IN ('breakfast', 'lunch', 'dinner', 'starter', 'main', 'side', 'dessert', 'snack');
