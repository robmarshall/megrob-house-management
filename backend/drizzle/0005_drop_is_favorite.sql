-- Drop the legacy is_favorite column from recipes table
-- Per-user favorites are now stored in the user_favorites junction table (since migration 0002)
-- The is_favorite column is dead code that causes confusion and incorrect PATCH behavior

ALTER TABLE recipes DROP COLUMN is_favorite;
