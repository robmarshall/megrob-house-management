# Spec 005: Recipe Feature Enhancements

## Problem
The recipe feature is functional but missing several user experience improvements outlined in the original RECIPES-PLAN.md as medium/lower priority.

## Requirements

### Step-by-Step Cooking Mode
- Full-screen mode showing one instruction step at a time
- Large font, high contrast for kitchen readability
- Previous/Next navigation with progress indicator
- Keep-awake screen behavior (via Wake Lock API where supported)
- Show current step's relevant ingredients alongside instruction

### Recipe Images
- Add optional `image_url` field to recipes table
- Scrape og:image or recipe image from imported URLs
- Display image on recipe cards and detail page
- No image upload (URL-based only for v1)

### StarRating Atom Component
- 1-5 star rating input component
- Reusable atom for recipe rating display/edit
- Show average rating on recipe cards (currently rating field exists but no UI component)

### TimeBadge Atom Component
- Display prep time and cook time in a compact badge format
- Shows "15m prep | 30m cook" or "45m total"
- Used on recipe cards and detail pages

## Database Changes
- Add `image_url text` column to `recipes` table (migration)

## Files to Create/Modify
- `frontend/src/components/atoms/StarRating.tsx` (new)
- `frontend/src/components/atoms/TimeBadge.tsx` (new)
- `frontend/src/pages/RecipeDetailPage.tsx` (add print button, cooking mode entry)
- `frontend/src/pages/CookingModePage.tsx` (new)
- `frontend/src/App.tsx` (add cooking mode route)
- `backend/src/lib/recipeScraper.ts` (extract image URL during scraping)
- `backend/drizzle/` (new migration for image_url column)
- Print stylesheet in `frontend/src/index.css`

## Out of Scope
- Image upload from device
- Image optimization/resizing
- Video support
- Recipe sharing via social media
