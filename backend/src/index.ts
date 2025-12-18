import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import dotenv from "dotenv";
import { auth } from "./lib/auth.js";
import shoppingListsRoutes from "./routes/shoppingLists.js";
import shoppingListItemsRoutes from "./routes/shoppingListItems.js";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "FRONTEND_URL",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error(
    "\nPlease check your .env file and ensure all required variables are set."
  );
  process.exit(1);
}

const app = new Hono();

// Middleware - Configure CORS with specific origin for credentials
app.use(
  "/*",
  cors({
    origin: process.env.FRONTEND_URL!,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check routes (public, no auth required)
app.get("/", (c) => {
  return c.json({ message: "Hello from Hono API!" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Better Auth routes - handles all /api/auth/* endpoints
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// API routes (protected with auth middleware)
app.route("/api/shopping-lists", shoppingListsRoutes);
app.route("/api/shopping-lists", shoppingListItemsRoutes);

const port = parseInt(process.env.PORT || "3000");

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
