# Spec 011: Mobile Responsive Polish & UX Improvements

## Problem
While the app uses Tailwind responsive classes, several areas need refinement for a production mobile experience.

## Requirements

### Navigation
- Bottom navigation bar on mobile (Home, Shopping, Recipes, Meal Plan, More)
- Keep top AppHeader for desktop; hide on mobile in favor of bottom nav
- Back navigation on detail pages

### Pull-to-Refresh
- Add pull-to-refresh gesture on list pages (shopping lists, recipes)
- Triggers TanStack Query refetch

### Swipe Actions
- Swipe left on shopping list items to reveal delete action
- Swipe right on shopping list items to toggle checked

### Empty States
- Improve empty state illustrations on all list pages
- Clear CTAs ("Add your first recipe", "Create a shopping list")

### Loading States
- Skeleton loaders for list pages instead of spinner
- Skeleton cards matching actual card dimensions

### Haptic Feedback
- Vibration on checkbox toggle (where Vibration API is available)

## Files to Create/Modify
- `frontend/src/components/organisms/BottomNav.tsx` (new)
- `frontend/src/components/templates/MainLayout.tsx` (conditionally render bottom nav)
- `frontend/src/components/molecules/SkeletonCard.tsx` (new)
- `frontend/src/components/molecules/PullToRefresh.tsx` (new)
- Various page files (integrate skeleton loaders, improve empty states)

## Out of Scope
- Native app wrapper (Capacitor/React Native)
- Platform-specific UI (iOS vs Android styling)
