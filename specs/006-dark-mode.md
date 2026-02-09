# Spec 006: Dark Mode Support

## Problem
The app currently only supports a light theme. Dark mode is a common user expectation for modern apps, especially for evening/nighttime use.

## Requirements
- System-preference-aware: respect `prefers-color-scheme` media query by default
- Manual toggle: user can override system preference (light/dark/system)
- Persist preference in localStorage
- All components must support both themes
- Smooth transition between themes (no flash of wrong theme on load)

## Implementation Approach
- Use Tailwind CSS `dark:` variant (add `darkMode: 'class'` to tailwind config)
- Create a `ThemeProvider` context that manages the current theme
- Toggle adds/removes `dark` class on `<html>` element
- Add theme toggle to AppHeader navigation drawer

## Files to Create/Modify
- `frontend/tailwind.config.js` (add darkMode: 'class')
- `frontend/src/contexts/ThemeContext.tsx` (new)
- `frontend/src/hooks/useTheme.ts` (new)
- `frontend/src/components/organisms/AppHeader.tsx` (add theme toggle)
- `frontend/src/main.tsx` (wrap with ThemeProvider, initialize from localStorage)
- All component files (add `dark:` Tailwind variants as needed)

## Out of Scope
- Custom theme colors beyond light/dark
- Per-user server-side theme storage
- High-contrast accessibility theme
