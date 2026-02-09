# Spec 002: Meal Planning

## Problem
The home page shows "Meal Planning - Coming Soon" as a grayed-out card. Users have recipes but no way to plan meals for the week or generate shopping lists from meal plans.

## Requirements
- Create weekly meal plans with slots for each meal (breakfast, lunch, dinner, snacks)
- Assign existing recipes to meal slots via search/picker
- Support free-text entries for meals without recipes
- View current week at a glance with navigation to past/future weeks
- Generate a shopping list from a meal plan (combines ingredients from all assigned recipes, merges duplicates using existing `addOrMergeItems` service)
- Copy a previous week's plan to a new week

## Database Schema
- `meal_plans` table: id, name (optional), week_start_date (date, unique per user), created_by, updated_by, created_at, updated_at
- `meal_plan_entries` table: id, meal_plan_id (FK), day_of_week (0-6), meal_type (breakfast/lunch/dinner/snack), recipe_id (FK, nullable), custom_text (nullable), position, created_at

## API Endpoints
- `GET /api/meal-plans?week=YYYY-MM-DD` - Get meal plan for a specific week
- `POST /api/meal-plans` - Create a new meal plan
- `PATCH /api/meal-plans/:id` - Update meal plan metadata
- `DELETE /api/meal-plans/:id` - Delete a meal plan
- `POST /api/meal-plans/:id/entries` - Add entry to meal plan
- `PATCH /api/meal-plans/:id/entries/:entryId` - Update entry
- `DELETE /api/meal-plans/:id/entries/:entryId` - Remove entry
- `POST /api/meal-plans/:id/to-shopping-list` - Generate shopping list from plan

## Frontend
- `MealPlanPage` - Weekly calendar view with drag-and-drop meal assignment
- `MealPlanEntry` molecule - Individual meal slot with recipe picker
- `useMealPlans` / `useMealPlanData` hooks following existing patterns
- Route: `/meal-plans` (protected)
- Update `HomePage` to link to meal plans instead of showing "Coming Soon"

## Out of Scope
- Nutritional tracking/calorie counting
- Meal suggestion/AI recommendations
- Multi-week view
