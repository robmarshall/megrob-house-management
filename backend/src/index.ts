import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db } from './db/index';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();

// Middleware
app.use('/*', cors());

// Routes
app.get('/', (c) => {
  return c.json({ message: 'Hello from Hono API!' });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = parseInt(process.env.PORT || '3000');

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
