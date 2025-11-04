import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db } from './db/index.js';
import dotenv from 'dotenv';
import shoppingListsRoutes from './routes/shoppingLists.js';
import shoppingListItemsRoutes from './routes/shoppingListItems.js';

dotenv.config();

const app = new Hono();

// Middleware
app.use('/*', cors());

// Health check routes (public, no auth required)
app.get('/', (c) => {
  return c.json({ message: 'Hello from Hono API!' });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (protected with auth middleware)
app.route('/api/shopping-lists', shoppingListsRoutes);
app.route('/api/shopping-lists', shoppingListItemsRoutes);

const port = parseInt(process.env.PORT || '3000');

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
