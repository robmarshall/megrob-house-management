# Spec 013: Schema Cleanup & Dead Code Removal

## Problem
The database schema contains columns that are no longer used, and the codebase has dead code that creates confusion and maintenance burden.

## Requirements

### Database Cleanup
- Drop `is_favorite` column from `recipes` table (new migration)
  - Per-user favorites are now in `user_favorites` table (since migration 0002)
  - Remove `isFavorite` from the PATCH route body handling in recipes.ts
  - Remove `isFavorite` from `updateRecipeSchema` in validation.ts
  - Remove `isFavorite` from Drizzle schema definition in schema.ts

### Dead Code Removal
- Remove `sendWelcomeEmail()` function from `backend/src/lib/email.ts` (never called, signup is disabled)
- Clean up any imports that reference removed code

### Rating Field Clarification
- Decide: keep `rating` as a per-recipe aggregate (computed from feedback averages) or remove it
- If keeping: update PATCH to compute from feedback rather than accepting direct input
- If removing: drop column in migration, remove from schema and validation

## Files to Create/Modify
- `backend/drizzle/0004_*.sql` or `0005_*.sql` (new migration to drop columns)
- `backend/src/db/schema.ts` (remove isFavorite column definition)
- `backend/src/routes/recipes.ts` (remove isFavorite from PATCH handler)
- `backend/src/lib/validation.ts` (remove isFavorite from updateRecipeSchema)
- `backend/src/lib/email.ts` (remove sendWelcomeEmail)

## Out of Scope
- Changing the rating system to a star-based UI (covered by Spec 005)
- Removing the rating column entirely (may still be useful)
