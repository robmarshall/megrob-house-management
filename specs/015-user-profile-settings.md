# Spec 015: User Profile & Settings Page

## Problem
There is no user profile or settings page. Users cannot view or update their profile information, change their password from within the app, or configure preferences.

## Requirements

### User Profile Section
- Display user's name and email
- Allow editing display name
- Change password (current password + new password + confirm)
- Show account creation date

### App Settings Section
- Theme preference: light/dark/system (lays groundwork for Spec 006)
- Store preferences in localStorage initially
- Future: notification preferences, household settings (Spec 009)

### Navigation
- Settings accessible from AppHeader menu (gear icon or "Settings" link)
- Route: `/settings` (protected)

## API Endpoints
- `PATCH /api/user/profile` - Update display name
- `POST /api/user/change-password` - Change password (requires current password)
- Better Auth may already provide some of these via its built-in endpoints

## Files to Create/Modify
- `frontend/src/pages/SettingsPage.tsx` (new)
- `frontend/src/components/organisms/ProfileForm.tsx` (new)
- `frontend/src/App.tsx` (add /settings route)
- `frontend/src/components/organisms/AppHeader.tsx` (add settings link)
- `backend/src/routes/user.ts` (new - if Better Auth doesn't cover profile updates)

## Out of Scope
- Household management (Spec 009)
- Avatar/profile picture upload
- Two-factor authentication
- Account deletion
