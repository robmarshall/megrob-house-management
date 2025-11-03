# Shopping List Management Feature - Implementation Plan

## Overview

Build a full-featured shopping list management system with multiple lists, categorized items, and real-time UI updates. This Enhanced MVP focuses on core functionality while setting up the foundation for future features like sharing and purchase history.

## Phase 1: Database Schema & Backend API

### 1.1 Database Schema (`backend/src/db/schema.ts`)

Create tables using Drizzle ORM:

**`shopping_lists` table:**

- id (serial, primary key)
- name (text, required)
- description (text, optional)
- created_at (timestamp)
- updated_at (timestamp)
- created_by (user id)
- updated_by (user id)

**`shopping_list_items` table:**

- id (serial, primary key)
- list_id (integer, references shopping_lists)
- name (text, required)
- category (text, optional - e.g., "produce", "dairy", "hardware")
- quantity (numeric, default 1)
- unit (text, optional - e.g., "lbs", "oz", "items")
- notes (text, optional)
- checked (boolean, default false)
- checked_at (timestamp, nullable)
- checked_by (user id)
- created_at (timestamp)
- created_by (user id)
- updated_at (timestamp)
- updated_by (user id)
- position (integer, for custom ordering)

### 1.2 API Endpoints (`backend/src/index.ts` or new route files)

Create RESTful endpoints following existing Hono patterns:

**Shopping Lists:**

- `GET /api/shopping-lists` - Get all lists for authenticated user
- `POST /api/shopping-lists` - Create new list
- `GET /api/shopping-lists/:id` - Get single list with items
- `PUT /api/shopping-lists/:id` - Update list
- `DELETE /api/shopping-lists/:id` - Delete list

**Shopping List Items:**

- `GET /api/shopping-lists/:listId/items` - Get all items for a list
- `POST /api/shopping-lists/:listId/items` - Add item to list
- `PUT /api/shopping-lists/:listId/items/:itemId` - Update item
- `DELETE /api/shopping-lists/:listId/items/:itemId` - Delete item
- `PATCH /api/shopping-lists/:listId/items/:itemId/toggle` - Toggle checked state

### 1.3 Authentication Middleware

Add middleware to verify Supabase JWT tokens and attach user_id to requests

## Phase 2: Frontend Types & Utilities

### 2.1 TypeScript Types (`frontend/src/types/shoppingList.ts`)

```typescript
interface ShoppingList {
  ...Take from backend table
  items?: ShoppingListItem[]
}

interface ShoppingListItem {
  ...take from backend table
}
```

### 2.2 Validation Schemas (`frontend/src/lib/schemas.ts`)

Add Zod schemas:

- `createShoppingListSchema` (name, description)
- `updateShoppingListSchema`
- `createShoppingListItemSchema` (name, category, quantity, unit)
- `updateShoppingListItemSchema`

### 2.3 API Client (`frontend/src/lib/api/shoppingLists.ts`)

Create typed API functions using fetch with Supabase auth headers

### 2.4 Custom Hooks (`frontend/src/hooks/`)

- `useShoppingLists.ts` - Fetch and manage lists
- `useShoppingList.ts` - Fetch single list with items
- `useShoppingListMutations.ts` - Create/update/delete operations

## Phase 3: Atomic Components

### 3.1 New Atoms (`frontend/src/components/atoms/`)

- `Checkbox.tsx` - Styled checkbox input
- `Badge.tsx` - Category badges
- `IconButton.tsx` - Icon-only button variant
- `Card.tsx` - Generic card container

### 3.2 New Molecules (`frontend/src/components/molecules/`)

- `ShoppingListItem.tsx` - Item row with checkbox, name, quantity, category badge, delete button
- `AddItemInput.tsx` - Quick-add input with category/quantity fields
- `ListHeader.tsx` - List name, description, action buttons
- `EmptyState.tsx` - "No items" or "No lists" placeholder

### 3.3 New Organisms (`frontend/src/components/organisms/`)

- `CreateListForm.tsx` - Modal/form to create new list (name, description)
- `EditListForm.tsx` - Edit list details
- `ShoppingListCard.tsx` - Card showing list summary with item count, click to open
- `ShoppingListDetail.tsx` - Full list view with all items, add item input, filters
- `CategoryFilter.tsx` - Filter items by category

## Phase 4: Pages & Navigation

### 4.1 New Pages (`frontend/src/pages/`)

- `ShoppingListsPage.tsx` - Grid/list of all shopping lists, "Create New" button
- `ShoppingListDetailPage.tsx` - Single list view with items

### 4.2 Navigation Component (`frontend/src/components/organisms/Navigation.tsx`)

Create app navigation with links:

- Home/Dashboard
- Shopping Lists
- Logout
- (Placeholders for future: Recipes, Meal Plans)

### 4.3 Update Routing (`frontend/src/App.tsx`)

Add routes:

- `/shopping-lists` - ShoppingListsPage
- `/shopping-lists/:id` - ShoppingListDetailPage

Update HomePage to be a dashboard or redirect to shopping lists

## Phase 5: Core Features Implementation

### 5.1 List Management

- Create new shopping list (modal or dedicated page)
- View all lists in grid/card layout
- Edit list name/description
- Delete list (with confirmation)
- Show item count on list cards

### 5.2 Item Management

- Add items to list (quick add input at top)
- Edit item details (inline or modal)
- Delete items
- Reorder items (drag-and-drop or up/down buttons - optional)
- Toggle checked state with visual feedback

### 5.3 Categories

- Predefined categories: Produce, Dairy, Meat, Bakery, Pantry, Frozen, Beverages, Household, Other
- Category badges with color coding
- Filter/group items by category

### 5.4 UX Enhancements

- Loading states while fetching
- Optimistic UI updates (check items instantly) - USE TANSTACK QUERY
- Error handling with user-friendly messages
- Empty states for no lists/items
- Confirmation dialogs for destructive actions
- Responsive design (mobile-first)

## Technical Decisions

✅ **State Management**: Custom hooks with local state, no global state library needed yet
✅ **Styling**: Tailwind CSS following existing patterns with custom primary colors
✅ **Forms**: React Hook Form + Zod (consistent with auth forms)
✅ **API**: REST endpoints via Hono backend
✅ **Database**: PostgreSQL via Supabase with Drizzle ORM
✅ **Auth**: Supabase JWT tokens in API Authorization header

## Deferred to Future Phases

🔮 **Real-time sharing** - Requires Supabase real-time subscriptions + permissions
🔮 **Purchase history** - Separate table for archived items with analytics
🔮 **Multi-user collaboration** - Shared lists with permissions
🔮 **Offline support** - Service workers and local storage
🔮 **Recipe integration** - Link lists to meal plans

## Files to Create/Modify

**Backend (15+ files):**

- Modify: `backend/src/db/schema.ts`
- Create: Migration files in `backend/drizzle/`
- Create: `backend/src/routes/shoppingLists.ts`
- Create: `backend/src/routes/shoppingListItems.ts`
- Create: `backend/src/middleware/auth.ts`
- Modify: `backend/src/index.ts`

**Frontend (25+ files):**

- Create: `frontend/src/types/shoppingList.ts`
- Modify: `frontend/src/lib/schemas.ts`
- Create: `frontend/src/lib/api/shoppingLists.ts`
- Create: `frontend/src/hooks/useShoppingLists.ts`
- Create: `frontend/src/hooks/useShoppingList.ts`
- Create: 4 new atom components
- Create: 4 new molecule components
- Create: 5 new organism components
- Create: 2 new page components
- Modify: `frontend/src/App.tsx`

**Estimated Scope:** 40+ files to create/modify
