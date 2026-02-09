# Implementation Plan

> Last updated: 2026-02-08
> Project: Home Management App (Shopping Lists, Recipes, Meal Planning, Tasks, Inventory)

## Current State Summary

### Completed Features
- **Authentication**: Better Auth with session-based login, password reset (no public signup by design)
- **Shopping Lists**: Full CRUD for lists and items, category badges, item merging via fuzzy matching, position ordering, check/uncheck with attribution
- **Recipes**: Full CRUD, URL import via QueueBear async scraping, ingredient parsing, allergen auto-detection, serving scaling, per-user favorites (userFavorites table), feedback (like/dislike with notes), add-to-shopping-list, search/filter by meal type/dietary/allergen/cuisine/difficulty
- **Frontend Architecture**: Atomic design (11 atoms, 18 molecules, 9 organisms, 2 templates, 9 pages), React Hook Form + Zod, TanStack Query, Framer Motion animations, ErrorBoundary, responsive Tailwind CSS
- **Backend Architecture**: Hono routes with Zod validation middleware, auth middleware, Drizzle ORM with 11 tables, 15 indexes, 4 migrations
- **Infrastructure**: Docker Compose (PostgreSQL + dev container), GitHub Actions for migration deployment

### Specs Index
| # | Title | Status |
|---|-------|--------|
| 001 | Toast Notification System | COMPLETE (v0.0.23) |
| 002 | Meal Planning | NOT STARTED |
| 003 | Household Tasks | NOT STARTED |
| 004 | Inventory Tracking | NOT STARTED |
| 005 | Recipe Enhancements | NOT STARTED |
| 006 | Dark Mode | NOT STARTED |
| 007 | PWA & Offline | NOT STARTED |
| 008 | Testing Infrastructure | COMPLETE (v0.0.25) |
| 009 | List Sharing & Household Collaboration | COMPLETE (v0.0.26) |
| 010 | Structured Logging & Error Handling | COMPLETE (v0.0.24) |
| 011 | Mobile Responsive Polish | NOT STARTED |
| 012 | Security Hardening & Backend Fixes | COMPLETE (v0.0.21) |
| 013 | Schema Cleanup & Dead Code Removal | COMPLETE (v0.0.22) |
| 014 | Frontend Bug Fixes & Component Polish | COMPLETE (v0.0.20) |
| 015 | User Profile & Settings Page | COMPLETE (v0.0.27) |

### Verified Issues (Code-Level)
These are confirmed bugs found in the current codebase, not assumptions:

1. **Badge atom missing semantic variants**: `RecipeFilters.tsx` uses `info`, `success`, `warning`, `error` variants; `RecipeDetailPage.tsx` uses `warning`, `success`, `primary`; `RecipesPage.tsx` uses `gray`, `success`, `warning`, `error` — none of these exist in `Badge.tsx` (only shopping-category variants defined)
2. **Button hardcoded colors**: `Button.tsx:22` uses `bg-blue-600` instead of `bg-primary-600` from Tailwind config
3. **Favorite toggle uses wrong endpoint**: `RecipeDetailPage.tsx:42` calls `editRecipe(recipeId, { isFavorite: !recipe.isFavorite })` via PATCH instead of dedicated `POST /api/recipes/:id/favorite`
4. **Dead `isFavorite` column still written**: `recipes.ts:558` writes to dead `isFavorite` column on PATCH; `schema.ts:76` still defines it; `validation.ts:62` still validates it
5. **Dead `sendWelcomeEmail()` function**: `email.ts:53` — never called (signup disabled by design)
6. **Feedback INSERT throws on duplicate**: `recipes.ts:906` does raw INSERT but unique constraint on `(recipe_id, user_id)` exists — should be UPSERT
7. **No pagination validation**: `shoppingLists.ts:25-26`, `recipes.ts:67-68`, `shoppingListItems.ts:51-53` — page/pageSize parsed with `parseInt()` but never validated for bounds
8. **QueueBear localhost fallback**: `queuebear.ts:11` — `QUEUEBEAR_REDIRECT_URL || 'http://localhost:3000'` is unsafe for production
9. **QueueBear env vars not validated at startup**: `index.ts` validates 4 env vars but not QUEUEBEAR_API_KEY, QUEUEBEAR_PROJECT_ID, QUEUEBEAR_REDIRECT_URL
10. **Checkbox XSS risk**: `Checkbox.tsx:93` uses `dangerouslySetInnerHTML={{ __html: label }}` — documented as intentional for HTML links in labels, but should sanitize input
11. **RecipeForm double type cast**: `RecipeForm.tsx:137` uses `as unknown as CreateRecipeFormData` — instructions transform from `{ step: string }[]` to `string[]` bypasses TypeScript
12. **No rate limiting on auth endpoints**: Login and password reset have no brute-force protection
13. ~~**Recipe authorization inconsistency**: PATCH allows any authenticated user to edit any recipe; DELETE checks ownership~~ (RESOLVED by Spec 009 — all recipe endpoints now use household-scoped `verifyRecipeAccess`; DELETE uses stricter `verifyRecipeOwnership` requiring creator)

---

## Tier 0: Critical Bug Fixes & Security (Do First)

Bugs and security issues affecting correctness of the current production system. No new features until these are resolved.

### 0.1 Frontend Component Bugs (Spec 014) [COMPLETE]
- **Status**: COMPLETE (v0.0.20) — committed f78b7b0
- **Completed**: 2026-02-09
- **Summary**: Added 6 semantic Badge variants, fixed Button theming to use primary colors with size prop, replaced Checkbox dangerouslySetInnerHTML with safe ReactNode rendering, fixed favorite toggle to use dedicated POST endpoint, fixed RecipeForm type cast with RecipeFormSubmitData type, fixed 11 additional TypeScript build errors

### 0.2 Backend Security Hardening (Spec 012) [COMPLETE]
- **Status**: COMPLETE (v0.0.21) — committed 7a51b3b
- **Completed**: 2026-02-08
- **Summary**: Added pagination validation (page >= 1, pageSize 1-100) to all list endpoints, created in-memory rate limiter using socket-level IP via getConnInfo() for auth endpoints (login 5/min, password reset 3/min), changed recipe feedback to UPSERT, added unique constraint migration on recipe_categories, validated QueueBear env vars at startup with localhost fallback removed, added auth check on recipe import status endpoint, documented shared-edit policy

### 0.3 Schema Cleanup & Dead Code (Spec 013) [COMPLETE]
- **Status**: COMPLETE (v0.0.22) — committed 9f140d0
- **Completed**: 2026-02-08
- **Summary**: Created migration 0005 to drop `is_favorite` column from recipes table. Removed `isFavorite` from Drizzle schema, update validation, and PATCH handler. Removed dead `sendWelcomeEmail()` from email.ts. Updated frontend Recipe type to make `isFavorite` optional (now computed per-user from userFavorites table). Rating field kept for Spec 005 StarRating component.

---

## Tier 1: Foundation (Enables Better UX for Everything After)

### 1.1 Toast Notification System (Spec 001) [COMPLETE]
- **Status**: COMPLETE (v0.0.23) — committed fdb89ac
- **Completed**: 2026-02-08
- **Summary**: Implemented toast notification system using react-toastify v11. Created thin toast wrapper (`frontend/src/lib/toast.ts`) with project defaults (4s success, 8s error). Added ToastContainer to App.tsx (bottom-right desktop, bottom-center mobile via CSS media query). Integrated success+error toasts into all useData mutations and recipe-specific hooks. Replaced 9 console.error calls with toast.error or hook-level delegation. CSS variable overrides for design system colors. 17 files modified.
- **Learnings**:
  - react-toastify renders string messages as React text nodes (not innerHTML), so displaying `error.message` from API is XSS-safe
  - Toggle-style actions (favorite) benefit more from visual icon state change than toast notifications — avoid toast spam on rapid toggles

### 1.2 Structured Logging & Error Handling (Spec 010) [COMPLETE]
- **Status**: COMPLETE (v0.0.24) — committed f7ded04
- **Completed**: 2026-02-08
- **Summary**: Replaced all 43 console.log/console.error calls with structured pino logger. Created environment-aware logger (pretty dev, JSON prod), request logging middleware with correlation IDs and duration tracking, centralized error handler with safe error responses. 13 files modified (3 new, 10 modified). TypeScript typecheck, build all pass.
- **Learnings**:
  - Correlation IDs: requestLogger generates IDs and logs them on entry/exit; errorHandler also includes them. For full tracing, a future enhancement could use `logger.child({ requestId })` stored in Hono context so all downstream logs include it automatically.
  - `pino-pretty` is in `dependencies` (not `devDependencies`) — acceptable since pino loads it dynamically via transport and a missing module at runtime would crash the app if `NODE_ENV` is unset. Could move to devDeps if deploy process guarantees `NODE_ENV=production`.
  - Hono context variables (`c.set`/`c.get`) are untyped without a generic `Env` type on `new Hono<Env>()` — this is a pre-existing pattern across the codebase, not introduced by this change.

### 1.3 Testing Infrastructure (Spec 008) [COMPLETE]
- **Status**: COMPLETE (v0.0.25) — committed 24c15f7
- **Completed**: 2026-02-08
- **Summary**: Set up Vitest for both backend and frontend with coverage configuration. Backend: 154 tests across 5 files covering ingredientParser (31), allergenDetector (41), itemMatcher (48), recipeScraper (26), validation middleware (8). Frontend: 55 tests across 5 files covering validators (17), errors (10), utils (7), Button (11), Badge (10). Weighted utility coverage ~95%. Hook tests, molecule tests, page integration tests, and Input/Checkbox atom tests remain as future work.

---

## Tier 2: Cross-Cutting Concerns (Before New Feature Modules)

### 2.1 Household Sharing & Collaboration (Spec 009) [COMPLETE]
- **Status**: COMPLETE (v0.0.26) — committed e82c11b
- **Completed**: 2026-02-08
- **Summary**: Implemented multi-user household system with DB migration (3 new tables + 2 column additions + 7 indexes), 9 household API endpoints (create, get, update, invite, join, decline, leave, remove member, cancel invitation), refactored all shopping list and recipe endpoints for household-scoped data access with backward-compatible personal data visibility. Added verifyRecipeAccess helper for consistent authorization. Frontend includes HouseholdPage with member management UI. All 154 backend + 55 frontend tests pass.
- **Learnings**:
  - When adding household scoping to existing routes, list endpoints and individual-access endpoints must BOTH be scoped. It's easy to add the access filter to the list query but forget the GET /:id, PATCH /:id, etc. Use a `verifyAccess(entityId, userId)` helper (like `verifyListAccess` in shoppingListItems.ts) and apply it consistently to every endpoint that touches a single record.
  - Invitation flow was implemented as in-app notifications rather than email. The DB schema supports either approach; email delivery can be added later without schema changes.
  - The `or(eq(table.householdId, id), and(eq(table.createdBy, userId), isNull(table.householdId)))` pattern lets users keep their personal (pre-household) data visible after joining a household. New data gets assigned to the household automatically.

### 2.2 User Profile & Settings (Spec 015) [COMPLETE]
- **Status**: COMPLETE (v0.0.27) — committed a8ebeac
- **Completed**: 2026-02-09
- **Summary**: Settings page with three sections: ProfileSection (display name edit, email/member-since display), ChangePasswordSection (current + new + confirm), AppSettingsSection (theme preference light/dark/system in localStorage). Extended AuthContext with updateProfile and changePassword methods using Better Auth built-in endpoints. Added rate limiting for update-user (10/min) and change-password (5/min). Form uses `values` prop for proper async session data sync. 7 files modified (1 new, 6 modified).

---

## Tier 3: Core Feature — Recipe Enhancements (Spec 005)

Builds on the solid existing recipe foundation to add premium UX features.

- **Status**: NOT STARTED
- **Tasks**:
  - Create StarRating atom component; wire to recipe `rating` field via PATCH API
  - Create TimeBadge atom component for prep/cook time display
  - Add recipe image support (image_url column migration, scrape og:image from imports, display on cards/detail)
  - Implement print-friendly recipe view with CSS print stylesheet
  - Build step-by-step cooking mode page with Wake Lock API, large font, ingredient reference panel
- **DB**: New migration for `image_url` column on recipes table
- **Files**: New: `StarRating.tsx`, `TimeBadge.tsx`, `CookingModePage.tsx`, print styles. Modify: `RecipeDetailPage.tsx`, `RecipesPage.tsx`, `recipeScraper.ts`, `App.tsx`

---

## Tier 4: Core Feature — Meal Planning (Spec 002)

The most-requested "Coming Soon" feature. Bridges recipes and shopping lists.

- **Status**: NOT STARTED
- **Tasks**:
  - Create meal_plans and meal_plan_entries database tables and migration
  - Implement meal plan API endpoints (CRUD + entry management + generate shopping list using existing `addOrMergeItems` service)
  - Build MealPlanPage with weekly calendar view and recipe picker (search existing recipes)
  - Add copy-previous-week functionality
  - Update HomePage to link to meal plans (replace "Coming Soon" placeholder)
- **DB**: New migration for `meal_plans` and `meal_plan_entries` tables
- **Backend**: New `backend/src/routes/mealPlans.ts`
- **Frontend**: New `MealPlanPage.tsx`, `MealPlanEntry.tsx`, `useMealPlans.ts`/`useMealPlanData.ts`

---

## Tier 5: Additional Feature Modules

### 5.1 Household Task Management (Spec 003)
- **Status**: NOT STARTED
- **Depends on**: Spec 009 (Household Sharing) for household context
- **Tasks**:
  - Create household_tasks table and migration
  - Implement tasks API (CRUD, complete with attribution, recurrence auto-creation)
  - Build TasksPage with filters (status, assignee, priority, due date), TaskCard, TaskForm
- **DB**: New migration for `household_tasks` table
- **Backend**: New `backend/src/routes/tasks.ts`
- **Frontend**: New `TasksPage.tsx`, `TaskCard.tsx`, `TaskForm.tsx`, `useTasks.ts`

### 5.2 Pantry & Inventory Tracking (Spec 004)
- **Status**: NOT STARTED
- **Depends on**: Spec 009 (Household Sharing) for household context
- **Tasks**:
  - Create inventory_items table and migration
  - Implement inventory API (CRUD, from-shopping-list transfer, expiration/low-stock alerts)
  - Build InventoryPage with location grouping and alert badges
- **DB**: New migration for `inventory_items` table
- **Backend**: New `backend/src/routes/inventory.ts`
- **Frontend**: New `InventoryPage.tsx`, `InventoryItemCard.tsx`, `InventoryForm.tsx`, `useInventory.ts`

---

## Tier 6: Polish & Progressive Enhancement

### 6.1 Mobile Responsive Polish (Spec 011)
- **Status**: NOT STARTED
- **Tasks**:
  - Build mobile bottom navigation bar (BottomNav organism) — show on mobile, hide on desktop; desktop keeps AppHeader
  - Implement skeleton loaders for all list pages (replace loading spinners)
  - Add pull-to-refresh gesture on list pages (triggers TanStack Query refetch)
  - Add swipe actions on shopping list items (swipe-left delete, swipe-right toggle check)
  - Improve empty states with illustrations and clear CTAs
  - Add haptic feedback on checkbox toggle (Vibration API)
- **Files**: New: `BottomNav.tsx`, `SkeletonCard.tsx`, `PullToRefresh.tsx`. Modify: `MainLayout.tsx`, page files

### 6.2 Dark Mode (Spec 006)
- **Status**: NOT STARTED
- **Note**: Best done after all feature components exist so all get dark mode at once
- **Tasks**:
  - Configure Tailwind dark mode ('class' strategy) and create ThemeProvider context
  - Respect `prefers-color-scheme` media query with manual override (light/dark/system)
  - Persist theme preference in localStorage; prevent flash of wrong theme on load
  - Add `dark:` variants to all components
  - Add theme toggle in AppHeader/Settings (integrates with Spec 015)
- **Files**: New: `ThemeContext.tsx`, `useTheme.ts`. Modify: `tailwind.config.js`, `main.tsx`, `AppHeader.tsx`, all component files

### 6.3 PWA & Offline Support (Spec 007)
- **Status**: NOT STARTED
- **Note**: Depends on core features being stable first
- **Tasks**:
  - Configure vite-plugin-pwa with manifest and service worker
  - Implement offline caching strategy (cache-first for static assets, stale-while-revalidate for API)
  - Add offline indicator banner and install prompt UI (show after second visit)
  - Queue mutations when offline, replay when online
- **Files**: New: `OfflineBanner.tsx`, `useOnlineStatus.ts`, app icons. Modify: `vite.config.ts`, `package.json`

---

## Dependency Graph

```
Tier 0 ────────────────────────────────────────────────────────────────────────
  0.1 Frontend Bug Fixes (014) ─┐
  0.2 Security Hardening (012) ─┤  (all independent, can be parallelized)
  0.3 Schema Cleanup (013) ─────┘
          │
Tier 1 ───▼────────────────────────────────────────────────────────────────────
  1.1 Toast System (001) ───────┐
  1.2 Structured Logging (010) ─┤  (all independent)
  1.3 Testing (008) ────────────┘
          │
Tier 2 ───▼────────────────────────────────────────────────────────────────────
  2.1 Household Sharing (009) ──┐
  2.2 User Settings (015) ──────┘  (independent of each other)
          │
Tier 3 ───▼────────────────────────────────────────────────────────────────────
  Recipe Enhancements (005) ────┐
          │                     │
Tier 4 ───▼─────────────────────▼──────────────────────────────────────────────
  Meal Planning (002) ──────────┘  (uses recipe integration)
          │
Tier 5 ───▼────────────────────────────────────────────────────────────────────
  5.1 Household Tasks (003) ────┐  (requires 009)
  5.2 Inventory Tracking (004) ─┘  (requires 009)
          │
Tier 6 ───▼────────────────────────────────────────────────────────────────────
  6.1 Mobile Polish (011) ──────┐
  6.2 Dark Mode (006) ──────────┤  (best after all features exist)
  6.3 PWA/Offline (007) ────────┘
```

---

## Not Planned (Deferred)

These were considered but deferred as premature for current stage:
- **Full-text search (pg_trgm/tsvector)**: Current ILIKE search with indexes sufficient for expected data volume
- **Data export/import (CSV/JSON)**: No user demand yet
- **Multi-language support (i18n)**: Heavy investment with low current ROI for household app
- **Push notifications**: Requires service worker infrastructure (Spec 007 prerequisite)
- **Barcode scanning for inventory**: Complex native API, deferred to post-MVP
- **Grocery store integration**: Store-specific lists/prices — complex, low immediate value
- **Expense/budget tracking**: Adjacent domain, better served by dedicated apps
- **Calendar integration (iCal/Google)**: Meal plan export — valuable but depends on Spec 002 first
- **API documentation (OpenAPI/Swagger)**: Useful for future third-party integration but not needed while app is single-client

---

## Learnings & Notes
- Column types in Drizzle ORM include literal `name` discriminants — use union types when mapping multiple columns of same SQL type
- Recipe `instructions` field stores a JSON array as text (not a JSON column type)
- The `isFavorite` boolean on recipes table is legacy dead code; per-user favorites use `user_favorites` junction table (migration 0002)
- QueueBear webhooks need signature verification via `QUEUEBEAR_SIGNING_SECRET` env var
- Better Auth signup is disabled by design (`disableSignUp: true`); user creation is admin-only
- All frontend forms must use FormProvider pattern with useFormContext() in atom components
- TanStack Query cache invalidation is automatic after mutations via useData hook
- Recipe edit policy is currently permissive (anyone can edit) while delete requires ownership — document as intentional shared-edit policy (Spec 012)
- Unique constraints exist on userFavorites(userId, recipeId) and recipeFeedback(recipeId, userId) via migrations 0002/0003
- 15 database indexes already exist (migration 0003) covering most common query patterns
- Recipe PATCH route still writes to dead `isFavorite` column (line 558 of recipes.ts) — fix in Spec 013
- Badge component only has shopping-category variants — 6 semantic variants needed (Spec 014)
- CategoryPicker molecule handles its own variant styling internally (not affected by Badge issue)
- Checkbox atom uses `dangerouslySetInnerHTML` for label — intentional for HTML links but XSS risk if user data flows in
- RecipeForm uses double type cast (`as unknown as`) for instruction transformation — type alignment needed
- PostgreSQL numeric type returns as string from Drizzle; manual `parseFloat()` normalization in item routes
- Backend has no test suite at all — 0 test files, no Vitest config, no test scripts in package.json (RESOLVED by Spec 008)
- Frontend has no test suite at all — same situation (RESOLVED by Spec 008)
- Spec 008 frontend scope was partially implemented: lib utilities + 2 atom components covered, but hook tests, molecule tests, page integration tests, Input/Checkbox atom tests still needed in future iterations
- `zod` is used directly in `backend/src/middleware/validation.ts` and its test but is only a transitive dependency via `better-auth` — should be added as explicit dependency to avoid breakage if better-auth changes
- recipeScraper.ts has dead code: `parsedUrl` variable (line 236-238) is assigned but never used after URL validation
- Frontend vitest.config.ts coverage `include` should be expanded beyond `src/lib/**` and `src/components/atoms/**` to cover hooks, molecules, organisms, and pages when those test categories are added
- GET `/api/recipes/:id/status` endpoint lacks auth middleware (intentional for polling during import)
- Homepage has 3 cards: Shopping Lists (active), Recipes (active), Meal Planning (Coming Soon placeholder)
- Rate limiter IP resolution: When using @hono/node-server directly (not behind reverse proxy), use `getConnInfo(c)` from `@hono/node-server/conninfo` for the real socket-level client IP. Trusting X-Forwarded-For/X-Real-IP headers without trusted-proxy validation makes rate limiting fully bypassable.
- In-memory rate limiters with Map stores need cleanup intervals to prevent memory exhaustion from IP rotation attacks
- Drizzle schema should declare unique constraints inline (not just via raw SQL migrations) to ensure onConflictDoUpdate targets are formally backed by schema definitions
- `parseInt()` accepts leading numeric characters in mixed strings (e.g. `parseInt("3abc")` → `3`). For stricter validation, use `Number()` + `Number.isInteger()`. Current usage is safe since parsed values flow through parameterized queries.
- IPv4-mapped IPv6 addresses (e.g. `::ffff:192.168.1.1`) can give a client two rate-limit buckets on dual-stack servers — low severity but worth noting for future hardening
- Better Auth provides `updateUser` and `changePassword` client methods out of the box — no custom backend routes needed for Spec 015 profile/password features
- When a spec mentions "groundwork for [future spec]" (e.g. theme preference for Spec 006), implement the foundational UI/storage even if the full feature comes later — reviewers will flag missing spec requirements
- Any new Better Auth endpoints exposed should have rate limiting added to match existing auth endpoint protection patterns
- Drizzle migrations are tracked by journal and run exactly once — `IF NOT EXISTS` safety is unnecessary and non-standard for Drizzle migration files
- react-toastify renders string arguments as React text nodes (not innerHTML) — no XSS risk from passing `error.message` strings. No `dangerouslySetInnerHTML` in the library source.
- react-toastify `position` prop is static — for responsive positioning (e.g., bottom-center on mobile, bottom-right on desktop), override `.Toastify__toast-container` with CSS media queries
- Household access control pattern: `verifyRecipeAccess` / `verifyListAccess` check household membership OR personal ownership, with `isNull()` for null-safe comparison on nullable householdId columns. DELETE operations should use a stricter `verifyOwnership` wrapper that additionally checks `createdBy`.
- When adding household scoping to existing endpoints, the list endpoint (GET /) and ALL individual-access endpoints must be updated — easy to miss individual endpoints that accept an ID parameter
- Unique constraint on `household_members.user_id` enforces the "one household per user" business rule at the database level, making application-level race conditions non-critical
- React Hook Form `defaultValues` are captured once at mount time. When forms depend on async data (e.g. user session), use the `values` prop instead to auto-sync form state when the data arrives. Otherwise the form stays on its initial (empty) defaults.
- Better Auth `useSession()` may not auto-refetch after `updateUser()` — verify cache invalidation behavior or trigger a manual refetch after mutations to avoid stale UI
