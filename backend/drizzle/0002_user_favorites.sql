-- Create user_favorites table for per-user recipe favorites
CREATE TABLE IF NOT EXISTS "user_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;

-- Add unique constraint to prevent duplicate favorites
CREATE UNIQUE INDEX "user_favorites_user_recipe_unique" ON "user_favorites" ("user_id", "recipe_id");

-- Migrate existing favorites from recipes table to user_favorites
-- This inserts a favorite for the recipe creator if isFavorite was true
INSERT INTO "user_favorites" ("user_id", "recipe_id", "created_at")
SELECT "created_by", "id", "created_at"
FROM "recipes"
WHERE "is_favorite" = true;
