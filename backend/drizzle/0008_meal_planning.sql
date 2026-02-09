-- Migration: Meal Planning (Spec 002)
-- Adds meal_plans and meal_plan_entries tables

CREATE TABLE "meal_plans" (
  "id" serial PRIMARY KEY,
  "name" text,
  "week_start_date" date NOT NULL,
  "household_id" integer REFERENCES "households"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "updated_by" text NOT NULL REFERENCES "user"("id")
);

CREATE TABLE "meal_plan_entries" (
  "id" serial PRIMARY KEY,
  "meal_plan_id" integer NOT NULL REFERENCES "meal_plans"("id") ON DELETE CASCADE,
  "day_of_week" integer NOT NULL,
  "meal_type" text NOT NULL,
  "recipe_id" integer REFERENCES "recipes"("id") ON DELETE SET NULL,
  "custom_text" text,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX "idx_meal_plans_household" ON "meal_plans" ("household_id");
CREATE INDEX "idx_meal_plans_created_by" ON "meal_plans" ("created_by");
CREATE INDEX "idx_meal_plans_week_start" ON "meal_plans" ("week_start_date");
CREATE INDEX "idx_meal_plan_entries_meal_plan" ON "meal_plan_entries" ("meal_plan_id");
CREATE INDEX "idx_meal_plan_entries_recipe" ON "meal_plan_entries" ("recipe_id");

-- Unique constraint: one plan per week per user (or per household)
CREATE UNIQUE INDEX "idx_meal_plans_week_user" ON "meal_plans" ("week_start_date", "created_by") WHERE "household_id" IS NULL;
CREATE UNIQUE INDEX "idx_meal_plans_week_household" ON "meal_plans" ("week_start_date", "household_id") WHERE "household_id" IS NOT NULL;
