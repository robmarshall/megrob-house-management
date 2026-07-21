CREATE TABLE "item_category_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer,
	"user_id" text NOT NULL,
	"normalized_name" text NOT NULL,
	"category" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_category_memory" ADD CONSTRAINT "item_category_memory_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_category_memory" ADD CONSTRAINT "item_category_memory_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_item_category_memory_household" ON "item_category_memory" USING btree ("household_id","normalized_name") WHERE "item_category_memory"."household_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_item_category_memory_user" ON "item_category_memory" USING btree ("user_id","normalized_name") WHERE "item_category_memory"."household_id" is null;