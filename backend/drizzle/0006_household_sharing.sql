-- Migration: Household Sharing & Collaboration (Spec 009)
-- Adds households, household_members, and household_invitations tables
-- Adds household_id column to shopping_lists and recipes for household-level data scoping

-- Create households table
CREATE TABLE IF NOT EXISTS "households" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create household_members table
CREATE TABLE IF NOT EXISTS "household_members" (
  "id" serial PRIMARY KEY,
  "household_id" integer NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member',
  "joined_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "household_members_user_unique" UNIQUE ("user_id")
);

-- Create household_invitations table
CREATE TABLE IF NOT EXISTS "household_invitations" (
  "id" serial PRIMARY KEY,
  "household_id" integer NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "invited_by" text NOT NULL REFERENCES "user"("id"),
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);

-- Add household_id to shopping_lists (nullable for backward compatibility during migration)
ALTER TABLE "shopping_lists" ADD COLUMN "household_id" integer REFERENCES "households"("id");

-- Add household_id to recipes (nullable for backward compatibility during migration)
ALTER TABLE "recipes" ADD COLUMN "household_id" integer REFERENCES "households"("id");

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_household_members_household" ON "household_members" ("household_id");
CREATE INDEX IF NOT EXISTS "idx_household_members_user" ON "household_members" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_household_invitations_household" ON "household_invitations" ("household_id");
CREATE INDEX IF NOT EXISTS "idx_household_invitations_email" ON "household_invitations" ("email");
CREATE INDEX IF NOT EXISTS "idx_household_invitations_status" ON "household_invitations" ("status");
CREATE INDEX IF NOT EXISTS "idx_shopping_lists_household" ON "shopping_lists" ("household_id");
CREATE INDEX IF NOT EXISTS "idx_recipes_household" ON "recipes" ("household_id");
