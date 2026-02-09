# Spec 001: Toast Notification System

## Problem
Users currently receive no visual feedback when actions succeed or fail. Errors are logged to the console only. Successful mutations (create, edit, delete) provide no confirmation to the user.

## Requirements
- Display success toasts after create, update, delete operations
- Display error toasts when API calls fail
- Toasts auto-dismiss after a configurable duration (default 4s for success, 8s for errors)
- Toasts stack vertically and support dismissal via click/swipe
- Accessible: screen readers should announce toast content
- Position: bottom-center on mobile, bottom-right on desktop

## Solution
Use **react-toastify** — a mature, well-maintained toast library with built-in accessibility, stacking, animations, and responsive positioning.

## Scope
- Install `react-toastify` as a dependency
- Add `<ToastContainer />` to the app root
- Create a thin `toast` utility wrapper (`frontend/src/lib/toast.ts`) that calls `react-toastify`'s `toast.success()`, `toast.error()`, etc. with project-standard defaults (durations, position)
- Integrate toast calls into `useData` mutation `onSuccess`/`onError` callbacks
- Override default react-toastify styles with Tailwind-compatible custom CSS to match the app's design system

## Files to Create/Modify
- `frontend/src/lib/toast.ts` (new — thin wrapper with project defaults)
- `frontend/src/App.tsx` (add `<ToastContainer />` with config)
- `frontend/src/index.css` (add react-toastify style overrides to match design system)
- `frontend/src/hooks/useData.ts` (add onSuccess/onError toast calls in mutations)

## Implementation Details

### 1. Install react-toastify
```bash
cd frontend && npm install react-toastify
```

### 2. Toast utility (`frontend/src/lib/toast.ts`)
```ts
import { toast as toastify, type ToastOptions } from 'react-toastify';

const defaultSuccess: ToastOptions = { autoClose: 4000 };
const defaultError: ToastOptions = { autoClose: 8000 };

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    toastify.success(message, { ...defaultSuccess, ...options }),
  error: (message: string, options?: ToastOptions) =>
    toastify.error(message, { ...defaultError, ...options }),
  info: (message: string, options?: ToastOptions) =>
    toastify.info(message, options),
  warning: (message: string, options?: ToastOptions) =>
    toastify.warning(message, options),
};
```

### 3. ToastContainer in App.tsx
```tsx
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Inside <App />:
<ToastContainer
  position="bottom-right"
  newestOnTop
  closeOnClick
  draggable
  pauseOnHover
/>
```

### 4. useData integration
Add toast calls to `onSuccess` and `onError` in each mutation inside `useData.ts`. Callers can still catch errors for custom handling; the toast provides baseline feedback.

## Out of Scope
- Persistent/sticky notifications
- Notification center or history
- Custom toast components (use react-toastify defaults, styled via CSS overrides)
