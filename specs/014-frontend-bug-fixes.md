# Spec 014: Frontend Bug Fixes & Component Polish

## Problem
Several frontend components have bugs that affect rendering and consistency with the design system.

## Requirements

### Badge Component Extension
- Add semantic color variants to Badge: `info`, `success`, `warning`, `error`, `primary`, `gray`
- These are used by RecipeFilters.tsx (info, success, warning, error), RecipeDetailPage.tsx (warning, success, primary), and RecipesPage.tsx (gray, success, warning, error) but not defined in BadgeVariant type
- Keep existing shopping category variants (fruitveg, dairy, meat, etc.)
- Assign appropriate colors: info=blue, success=green, warning=amber, error=red, primary=primary palette, gray=gray

### Button Color Fix
- Replace hardcoded `blue-600/700/500` in Button.tsx with `primary-600/700/500`
- Ensure consistency with Tailwind config's custom primary color palette

### Recipe Favorite Toggle Fix
- RecipeDetailPage calls `editRecipe({isFavorite})` via PATCH to toggle favorites
- Should instead call the dedicated `POST /api/recipes/:id/favorite` endpoint
- Update useRecipes hook if needed to expose a `toggleFavorite` mutation

### Checkbox XSS Risk
- `Checkbox.tsx:93` uses `dangerouslySetInnerHTML={{ __html: label }}` for label rendering
- Documented as intentional for embedding HTML links (e.g., terms and conditions)
- Replace with safe rendering: parse known link patterns into React elements, or sanitize with DOMPurify
- If HTML labels are not actually used in any current form, simplify to plain text rendering

### RecipeForm Type Safety
- `RecipeForm.tsx:137` uses double type cast `as unknown as CreateRecipeFormData`
- Instructions transform from `{ step: string }[]` (form schema) to `string[]` (API schema)
- Properly type the transformation function or adjust the schema to avoid bypassing TypeScript

### Frontend Console Cleanup
- Replace `console.error()` debug artifacts in catch blocks with proper error handling
- Once Spec 001 (toasts) is implemented, these should become toast.error calls
- Until then, wrap in `import.meta.env.DEV` check or remove

## Files to Modify
- `frontend/src/components/atoms/Badge.tsx` (add semantic variants)
- `frontend/src/components/atoms/Button.tsx` (fix primary color)
- `frontend/src/components/atoms/Checkbox.tsx` (fix dangerouslySetInnerHTML)
- `frontend/src/pages/RecipeDetailPage.tsx` (fix favorite toggle)
- `frontend/src/hooks/recipe/useRecipes.ts` (expose toggleFavorite if needed)
- `frontend/src/components/organisms/RecipeForm.tsx` (fix type cast)
- Various components with console.error (ShoppingListDetailPage, RecipesPage, AppHeader, etc.)

## Out of Scope
- Complete design system overhaul
- New component development
- Accessibility audit (covered partially by Spec 011)
