CREATE TABLE "ingredient_food_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"normalized_name" text NOT NULL,
	"unit" text NOT NULL,
	"source" text NOT NULL,
	"grams_per_unit" numeric NOT NULL,
	"calories_per_100g" numeric,
	"protein_per_100g" numeric,
	"carbs_per_100g" numeric,
	"fat_per_100g" numeric,
	"fiber_per_100g" numeric,
	"sugar_per_100g" numeric,
	"salt_per_100g" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_food_cache_name_unit_unique" UNIQUE("normalized_name","unit")
);
--> statement-breakpoint
CREATE TABLE "recipe_nutrition" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"calories_kcal" numeric,
	"protein_g" numeric,
	"carbs_g" numeric,
	"fat_g" numeric,
	"fiber_g" numeric,
	"sugar_g" numeric,
	"salt_g" numeric,
	"estimated" boolean DEFAULT false NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_nutrition_recipe_unique" UNIQUE("recipe_id")
);
--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD CONSTRAINT "recipe_nutrition_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;