import type { BadgeVariant } from "@/components/atoms/Badge";

/**
 * Shopping List TypeScript Interfaces
 * These types match the backend database schema
 */

/**
 * Shopping List
 * Represents a collection of items to shop for
 */
export interface ShoppingList {
  id: number;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  items?: ShoppingListItem[];
}

/**
 * Shopping List Item
 * Represents an individual item within a shopping list
 */
export interface ShoppingListItem {
  id: number;
  listId: number;
  name: string;
  category?: BadgeVariant | null;
  quantity: number; // Stored as numeric in DB, converted to number by API
  unit?: string | null;
  notes?: string | null;
  checked: boolean;
  checkedAt?: string | null;
  checkedBy?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Input types for creating/updating shopping lists
 */
export interface CreateShoppingListInput {
  name: string;
  description?: string;
}

export interface UpdateShoppingListInput {
  name?: string;
  description?: string;
}

/**
 * Input types for creating/updating shopping list items
 */
export interface CreateShoppingListItemInput {
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  position?: number;
}

export interface UpdateShoppingListItemInput {
  name?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  checked?: boolean;
  position?: number;
}
