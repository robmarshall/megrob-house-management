-- Declare in the Drizzle schema the unique constraints/indexes that previously
-- lived only in raw-SQL migrations (0002/0003/0004/0008), so a future db:push
-- can't silently drop them. These objects already exist in databases migrated
-- through 0008, so every statement is written to be idempotent (a no-op when
-- the object is already present) and only creates it on a fresh database.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_meal_plans_week_user" ON "meal_plans" USING btree ("week_start_date","created_by") WHERE "meal_plans"."household_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_meal_plans_week_household" ON "meal_plans" USING btree ("week_start_date","household_id") WHERE "meal_plans"."household_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_favorites_user_recipe_unique" ON "user_favorites" USING btree ("user_id","recipe_id");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_recipe_category') THEN
    ALTER TABLE "recipe_categories" ADD CONSTRAINT "unique_recipe_category" UNIQUE("recipe_id","category_type","category_value");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_recipe_feedback') THEN
    ALTER TABLE "recipe_feedback" ADD CONSTRAINT "unique_user_recipe_feedback" UNIQUE("recipe_id","user_id");
  END IF;
END $$;
