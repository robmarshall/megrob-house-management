# Spec 007: Progressive Web App & Offline Support

## Problem
The app has no PWA capabilities. Users cannot install it to their home screen, and it doesn't work offline.

## Requirements

### PWA Manifest
- App name, short name, description, icons (multiple sizes)
- Theme color matching app primary color
- Display mode: standalone
- Start URL: /

### Service Worker
- Cache static assets (JS, CSS, images) for offline access
- Cache API responses with stale-while-revalidate strategy for lists
- Queue mutations (create/update/delete) when offline, replay when online
- Show offline indicator banner when connectivity is lost

### Install Prompt
- Show "Add to Home Screen" prompt on mobile after second visit
- Dismissible, doesn't re-show if declined

## Implementation Approach
- Use `vite-plugin-pwa` for service worker generation and manifest
- Workbox strategies for caching
- Background sync for offline mutations

## Files to Create/Modify
- `frontend/vite.config.ts` (add PWA plugin config)
- `frontend/public/` (app icons in multiple sizes)
- `frontend/src/components/molecules/OfflineBanner.tsx` (new)
- `frontend/src/hooks/useOnlineStatus.ts` (new)
- `frontend/package.json` (add vite-plugin-pwa dependency)

## Out of Scope
- Push notifications
- Full offline CRUD (read-only cache for v1)
- Background data sync beyond queued mutations
