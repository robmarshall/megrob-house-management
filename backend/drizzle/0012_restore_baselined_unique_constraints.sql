-- Migration 0010 declared the unique constraints/indexes that db:push-era
-- databases were missing, but the prod migration journal was baselined at
-- 0010 (rows inserted manually), so drizzle-kit migrate never actually ran
-- it there. Prod therefore lacks unique_user_recipe_feedback, which the
-- POST /api/recipes/:id/feedback upsert targets via ON CONFLICT, making
-- every feedback insert fail with 42P10. Re-run the same statements so any
-- database that skipped 0010 catches up; databases that already ran 0010
-- no-op.
--
-- Unlike 0010, data may have accumulated without these constraints, so
-- dedupe first where duplicate rows are semantically identical. Duplicate
-- meal plans can't be auto-deleted (cascade would take user data with
-- them), so those indexes are skipped with a NOTICE if duplicates exist.
DELETE FROM recipe_feedback a USING recipe_feedback b
WHERE a.id < b.id AND a.recipe_id = b.recipe_id AND a.user_id = b.user_id;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_recipe_feedback') THEN
    ALTER TABLE "recipe_feedback" ADD CONSTRAINT "unique_user_recipe_feedback" UNIQUE("recipe_id","user_id");
  END IF;
END $$;--> statement-breakpoint
DELETE FROM user_favorites a USING user_favorites b
WHERE a.id < b.id AND a.user_id = b.user_id AND a.recipe_id = b.recipe_id;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_favorites_user_recipe_unique" ON "user_favorites" USING btree ("user_id","recipe_id");--> statement-breakpoint
DELETE FROM recipe_categories a USING recipe_categories b
WHERE a.id < b.id AND a.recipe_id = b.recipe_id AND a.category_type = b.category_type AND a.category_value = b.category_value;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_recipe_category') THEN
    ALTER TABLE "recipe_categories" ADD CONSTRAINT "unique_recipe_category" UNIQUE("recipe_id","category_type","category_value");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM meal_plans WHERE household_id IS NULL
    GROUP BY week_start_date, created_by HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'skipping idx_meal_plans_week_user: duplicate personal meal plans exist and need manual cleanup';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_meal_plans_week_user" ON "meal_plans" USING btree ("week_start_date","created_by") WHERE "meal_plans"."household_id" is null;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM meal_plans WHERE household_id IS NOT NULL
    GROUP BY week_start_date, household_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'skipping idx_meal_plans_week_household: duplicate household meal plans exist and need manual cleanup';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_meal_plans_week_household" ON "meal_plans" USING btree ("week_start_date","household_id") WHERE "meal_plans"."household_id" is not null;
  END IF;
END $$;
