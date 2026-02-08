import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import dotenv from "dotenv";
import { auth } from "./lib/auth.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import shoppingListsRoutes from "./routes/shoppingLists.js";
import shoppingListItemsRoutes from "./routes/shoppingListItems.js";
import recipesRoutes from "./routes/recipes.js";
import webhooksRoutes from "./routes/webhooks.js";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "FRONTEND_URL",
  "QUEUEBEAR_API_KEY",
  "QUEUEBEAR_PROJECT_ID",
  "QUEUEBEAR_REDIRECT_URL",
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

// CORS for auth routes (must be registered before auth handler)
app.use(
  "/api/auth/*",
  cors({
    origin: process.env.FRONTEND_URL!,
    credentials: true,
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    maxAge: 600,
  })
);

// CORS for other API routes
app.use(
  "/api/*",
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

// Handle OPTIONS preflight for auth routes explicitly
app.options("/api/auth/*", (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.FRONTEND_URL!,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "600",
    },
  });
});

// Rate limiting for auth endpoints (applied before auth handler)
// Login: 5 attempts per minute per IP
app.use("/api/auth/sign-in/*", rateLimiter(5, 60_000));
// Password reset: 3 attempts per minute per IP
app.use("/api/auth/forgot-password", rateLimiter(3, 60_000));

// Better Auth routes - handles all /api/auth/* endpoints
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const response = await auth.handler(c.req.raw);

  // Clone the response and add CORS headers since auth.handler bypasses Hono middleware
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", process.env.FRONTEND_URL!);
  headers.set("Access-Control-Allow-Credentials", "true");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

// API routes (protected with auth middleware)
app.route("/api/shopping-lists", shoppingListsRoutes);
app.route("/api/shopping-lists", shoppingListItemsRoutes);
app.route("/api/recipes", recipesRoutes);

// Webhook routes (no auth - verified by QueueBear signature)
app.route("/api/webhooks", webhooksRoutes);

const port = parseInt(process.env.PORT || "3000");

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
