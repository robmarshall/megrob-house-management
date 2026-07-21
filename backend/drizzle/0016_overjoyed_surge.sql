ALTER TABLE "recipes" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "public_id" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_public_id_unique" UNIQUE("public_id");--> statement-breakpoint
UPDATE "recipe_ingredients" SET "name" = left("name", 200) WHERE length("name") > 200;--> statement-breakpoint
UPDATE "recipe_ingredients" SET "unit" = left("unit", 50) WHERE length("unit") > 50;--> statement-breakpoint
UPDATE "recipe_ingredients" SET "notes" = left("notes", 500) WHERE length("notes") > 500;--> statement-breakpoint
UPDATE "recipes" SET "description" = left("description", 1000) WHERE length("description") > 1000;--> statement-breakpoint
UPDATE "recipes" SET "name" = left("name", 200) WHERE length("name") > 200;
