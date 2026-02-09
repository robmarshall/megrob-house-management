# Spec 004: Pantry & Inventory Tracking

## Problem
Users don't know what they already have at home, leading to duplicate purchases. There's no way to track pantry items, expiration dates, or low-stock alerts.

## Requirements
- Track pantry items with name, quantity, unit, category, location (fridge/freezer/pantry/other), and expiration date
- Low-stock alerts: user sets a minimum quantity threshold; items below show a warning
- Expiration alerts: highlight items expiring within configurable days (default 3 days)
- Quick-add from shopping list: when checking off a shopping list item, optionally add it to inventory
- Deduct from inventory: when starting a recipe, optionally deduct ingredients from inventory
- Barcode scanning (future consideration, not v1)

## Database Schema
- `inventory_items` table: id, name, quantity (numeric), unit, category, location (text), expiration_date (date, nullable), min_quantity (numeric, nullable), notes, created_by, updated_by, created_at, updated_at
- Index on: created_by, category, location, expiration_date

## API Endpoints
- `GET /api/inventory` - List items with filters (category, location, expiring_soon, low_stock)
- `POST /api/inventory` - Add item
- `GET /api/inventory/:id` - Get single item
- `PATCH /api/inventory/:id` - Update item (adjust quantity, etc.)
- `DELETE /api/inventory/:id` - Remove item
- `POST /api/inventory/from-shopping-list` - Bulk add from checked shopping list items
- `GET /api/inventory/alerts` - Get items that are low-stock or expiring soon

## Frontend
- `InventoryPage` - Inventory list grouped by location with alerts section
- `InventoryItemCard` molecule - Item display with quick quantity adjustment
- `InventoryForm` organism - Add/edit item form
- `useInventory` / `useInventoryData` hooks
- Route: `/inventory` (protected)
- Home page card linking to inventory

## Out of Scope
- Barcode scanning
- Automatic price tracking
- Store price comparison
- Warranty tracking (separate feature)
