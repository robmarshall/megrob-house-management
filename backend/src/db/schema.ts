import { pgTable, serial, text, timestamp, integer, numeric, boolean, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Database schema definitions
// Note: User authentication is handled by Supabase's auth.users table

/**
 * Shopping Lists Table
 * Stores user's shopping lists with metadata
 */
export const shoppingLists = pgTable('shopping_lists', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: uuid('created_by').notNull(), // references auth.users(id)
  updatedBy: uuid('updated_by').notNull(), // references auth.users(id)
});

/**
 * Shopping List Items Table
 * Stores individual items within shopping lists
 */
export const shoppingListItems = pgTable('shopping_list_items', {
  id: serial('id').primaryKey(),
  listId: integer('list_id')
    .notNull()
    .references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category'), // e.g., "produce", "dairy", "hardware"
  quantity: numeric('quantity').default('1'),
  unit: text('unit'), // e.g., "lbs", "oz", "items"
  notes: text('notes'),
  checked: boolean('checked').default(false).notNull(),
  checkedAt: timestamp('checked_at'),
  checkedBy: uuid('checked_by'), // references auth.users(id)
  position: integer('position').default(0).notNull(), // for custom ordering
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: uuid('created_by').notNull(), // references auth.users(id)
  updatedBy: uuid('updated_by').notNull(), // references auth.users(id)
});
