ALTER TABLE "meal_plans" DROP CONSTRAINT "meal_plans_household_id_fkey";
--> statement-breakpoint
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_household_id_fkey";
--> statement-breakpoint
ALTER TABLE "shopping_lists" DROP CONSTRAINT "shopping_lists_household_id_fkey";
--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
