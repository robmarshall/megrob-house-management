# Spec 008: Testing Infrastructure

## Problem
The codebase has zero test coverage across 50+ frontend components and 15+ backend files. No testing framework is configured.

## Requirements

### Backend Tests
- Unit tests for utility functions (ingredientParser, allergenDetector, itemMatcher, recipeScraper, validation)
- Integration tests for API routes (shopping lists, recipes, auth)
- Use Vitest as the test runner (consistent with frontend)
- Test database setup with migrations

### Frontend Tests
- Unit tests for hooks (useData, usePaginatedData, useAuth)
- Component tests for atoms (Input, Button, Checkbox, Badge)
- Component tests for key molecules (ShoppingListItem, AddItemBottomSheet)
- Integration tests for pages (LoginPage, ShoppingListsPage, RecipesPage)
- Use Vitest + React Testing Library

### Coverage Targets
- Utility functions: 90%+ coverage
- API routes: 80%+ coverage
- Frontend hooks: 80%+ coverage
- Frontend components: 60%+ coverage

## Files to Create/Modify
- `backend/vitest.config.ts` (new)
- `backend/src/__tests__/` (new directory)
- `frontend/vitest.config.ts` (new)
- `frontend/src/__tests__/` (new directory)
- `backend/package.json` (add vitest, test scripts)
- `frontend/package.json` (add vitest, @testing-library/react, test scripts)

## Out of Scope
- E2E tests (Playwright/Cypress - separate spec)
- Visual regression testing
- Performance testing
