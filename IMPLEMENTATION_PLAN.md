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
| 001 | Toast Notification System | NOT STARTED |
| 002 | Meal Planning | NOT STARTED |
| 003 | Household Tasks | NOT STARTED |
| 004 | Inventory Tracking | NOT STARTED |
| 005 | Recipe Enhancements | NOT STARTED |
| 006 | Dark Mode | NOT STARTED |
| 007 | PWA & Offline | NOT STARTED |
| 008 | Testing Infrastructure | NOT STARTED |
| 009 | List Sharing & Household Collaboration | NOT STARTED |
| 010 | Structured Logging & Error Handling | NOT STARTED |
| 011 | Mobile Responsive Polish | NOT STARTED |
| 012 | Security Hardening & Backend Fixes | COMPLETE (v0.0.21) |
| 013 | Schema Cleanup & Dead Code Removal | COMPLETE (v0.0.22) |
| 014 | Frontend Bug Fixes & Component Polish | COMPLETE (v0.0.20) |
| 015 | User Profile & Settings Page | NOT STARTED |

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
13. **Recipe authorization inconsistency**: PATCH allows any authenticated user to edit any recipe; DELETE checks ownership

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

### 1.1 Toast Notification System (Spec 001)
- **Status**: NOT STARTED
- **Why first**: Every subsequent feature benefits from user feedback on actions
- **Tasks**:
  - Implement ToastProvider context, useToast hook, Toast molecule component with Framer Motion animations
  - Success toasts (4s auto-dismiss) and error toasts (8s auto-dismiss) with stacking and swipe-to-dismiss
  - Integrate toasts into useData/usePaginatedData hooks for automatic mutation feedback
  - Replace all frontend console.error catch blocks with toast.error calls
- **Files**: New: `ToastContext.tsx`, `Toast.tsx`, `useToast.ts`. Modify: `main.tsx`, `useData.ts`, `usePaginatedData.ts`, all catch blocks in pages/organisms

### 1.2 Structured Logging & Error Handling (Spec 010)
- **Status**: NOT STARTED
- **Why**: Production debugging impossible with console.log; error handling is inconsistent
- **Tasks**:
  - Set up pino structured logger with environment-aware formatting (pretty dev, JSON prod)
  - Create request logging middleware (method, path, status, duration, userId, correlation ID)
  - Create centralized error handling middleware with safe error responses
  - Replace all backend console.log/console.error with structured logger
- **Files**: New: `logger.ts`, `requestLogger.ts`, `errorHandler.ts`. Modify: `index.ts`, all route files

### 1.3 Testing Infrastructure (Spec 008)
- **Status**: NOT STARTED
- **Why**: 0 tests across entire codebase; critical for confidence in changes
- **Tasks**:
  - Set up Vitest for backend with test database configuration
  - Write unit tests for utilities: ingredientParser, allergenDetector, itemMatcher, validation
  - Set up Vitest + React Testing Library for frontend
  - Write component tests for atoms (Input, Button, Badge, Checkbox)
  - Write integration tests for backend API routes (shopping lists, recipes)
- **Target**: 90%+ utility coverage, 80%+ route coverage, 60%+ component coverage

---

## Tier 2: Cross-Cutting Concerns (Before New Feature Modules)

### 2.1 Household Sharing & Collaboration (Spec 009)
- **Status**: NOT STARTED
- **Why**: Enables the core value proposition of a *home* management app — shared household data. This is a cross-cutting concern that touches every existing route and must be done before adding more features that need the same household filtering.
- **Tasks**:
  - Design and create household database schema (households, household_members, household_invitations tables)
  - Implement household API endpoints (create, invite via email, join, leave, remove)
  - Refactor ALL data queries to filter by household instead of individual user
  - Build HouseholdSettingsPage with member management UI
- **DB**: New migration for household tables; modify all existing queries
- **Backend**: New `backend/src/routes/households.ts`; modify shopping list, recipe, and (future) meal plan routes
- **Frontend**: New `HouseholdSettingsPage`, update AppHeader

### 2.2 User Profile & Settings (Spec 015)
- **Status**: NOT STARTED
- **Why**: No way for users to manage their profile, change password from within the app, or configure preferences
- **Tasks**:
  - Create Settings page with profile section (display name, email, change password via Better Auth)
  - Add app settings section (theme preference for Spec 006 groundwork, stored in localStorage)
  - Add /settings route and integrate into AppHeader navigation
- **Files**: New: `SettingsPage.tsx`, `ProfileForm.tsx`, `user.ts` route. Modify: `App.tsx`, `AppHeader.tsx`

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
- Backend has no test suite at all — 0 test files, no Vitest config, no test scripts in package.json
- Frontend has no test suite at all — same situation
- GET `/api/recipes/:id/status` endpoint lacks auth middleware (intentional for polling during import)
- Homepage has 3 cards: Shopping Lists (active), Recipes (active), Meal Planning (Coming Soon placeholder)
- Rate limiter IP resolution: When using @hono/node-server directly (not behind reverse proxy), use `getConnInfo(c)` from `@hono/node-server/conninfo` for the real socket-level client IP. Trusting X-Forwarded-For/X-Real-IP headers without trusted-proxy validation makes rate limiting fully bypassable.
- In-memory rate limiters with Map stores need cleanup intervals to prevent memory exhaustion from IP rotation attacks
- Drizzle schema should declare unique constraints inline (not just via raw SQL migrations) to ensure onConflictDoUpdate targets are formally backed by schema definitions
- `parseInt()` accepts leading numeric characters in mixed strings (e.g. `parseInt("3abc")` → `3`). For stricter validation, use `Number()` + `Number.isInteger()`. Current usage is safe since parsed values flow through parameterized queries.
- IPv4-mapped IPv6 addresses (e.g. `::ffff:192.168.1.1`) can give a client two rate-limit buckets on dual-stack servers — low severity but worth noting for future hardening
- Drizzle migrations are tracked by journal and run exactly once — `IF NOT EXISTS` safety is unnecessary and non-standard for Drizzle migration files
