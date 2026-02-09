# Spec 012: Security Hardening & Backend Fixes

## Problem
Several security and correctness issues exist in the backend API that should be fixed before adding new features.

## Requirements

### Pagination Validation
- Validate page >= 1 and pageSize between 1-100 on all paginated endpoints
- Return 400 with descriptive error for invalid values (including non-numeric strings)
- Apply to: GET /api/shopping-lists, GET /api/shopping-lists/:listId/items, GET /api/recipes

### Authorization Consistency
- Decide on recipe edit policy: either enforce ownership on PATCH /api/recipes/:id (consistent with DELETE) or explicitly document the shared-edit model
- If shared-edit is intentional, add a code comment and note in CLAUDE.md
- Add ownership/household check to GET /api/recipes/:id/status so users can only poll their own imports

### Recipe Feedback Upsert
- Change POST /api/recipes/:id/feedback from INSERT to upsert (ON CONFLICT UPDATE on recipe_id + user_id)
- The unique constraint already exists in migration 0003; the endpoint should not throw a DB error on duplicate

### Database Constraints
- Add unique constraint on recipeCategories(recipeId, categoryType, categoryValue) via new migration
- This prevents duplicates if delete-then-reinsert logic has a race condition

### Environment Variable Validation
- Add QUEUEBEAR_REDIRECT_URL, QUEUEBEAR_API_KEY, QUEUEBEAR_PROJECT_ID to the env var checker in index.ts
- Remove the localhost fallback from queuebear.ts; fail fast if not configured

### Rate Limiting
- Add rate limiting middleware on auth endpoints (POST /api/auth/sign-in, POST /api/auth/forgot-password)
- Limit: 5 attempts per minute per IP for login, 3 per minute for password reset

## Files to Create/Modify
- `backend/src/routes/recipes.ts` (pagination validation, feedback upsert, status auth check)
- `backend/src/routes/shoppingLists.ts` (pagination validation)
- `backend/src/routes/shoppingListItems.ts` (pagination validation)
- `backend/src/lib/queuebear.ts` (remove localhost fallback)
- `backend/src/index.ts` (add env var checks, rate limiting middleware)
- `backend/src/middleware/rateLimiter.ts` (new)
- `backend/drizzle/0004_*.sql` (new migration for recipeCategories constraint)

## Out of Scope
- WAF or external security tooling
- JWT/token-based auth migration
- Full RBAC system
