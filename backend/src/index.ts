import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import dotenv from "dotenv";
import { auth } from "./lib/auth.js";
import { logger } from "./lib/logger.js";
import { getMissingEnvVars } from "./lib/env.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { onError } from "./middleware/errorHandler.js";
import shoppingListsRoutes from "./routes/shoppingLists.js";
import shoppingListItemsRoutes from "./routes/shoppingListItems.js";
import recipesRoutes from "./routes/recipes.js";
import householdsRoutes from "./routes/households.js";
import mealPlansRoutes from "./routes/mealPlans.js";

dotenv.config();

// Validate required environment variables
const missingEnvVars = getMissingEnvVars();

if (missingEnvVars.length > 0) {
  logger.fatal({ missing: missingEnvVars }, "Missing required environment variables");
  process.exit(1);
}

const app = new Hono();

// Global error handler
app.onError(onError);

// Request logging middleware (applied to all routes)
app.use('*', requestLogger);

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

// Rate limiting for auth endpoints (applied before auth handler)
// Login: 5 attempts per minute per IP
app.use("/api/auth/sign-in/*", rateLimiter(5, 60_000));
// Password reset: 3 attempts per minute per IP
// Better Auth's request-password-reset endpoint (with /forget-password legacy alias)
app.use("/api/auth/request-password-reset", rateLimiter(3, 60_000));
app.use("/api/auth/forget-password", rateLimiter(3, 60_000));
// Profile update: 10 attempts per minute per IP
app.use("/api/auth/update-user", rateLimiter(10, 60_000));
// Password change: 5 attempts per minute per IP
app.use("/api/auth/change-password", rateLimiter(5, 60_000));

// Better Auth routes - handles all /api/auth/* endpoints.
// The cors() middleware registered above applies the Access-Control-* headers
// to this handler's response (verified in middleware/authCors.test.ts), so no
// manual CORS handling is needed here.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// API routes (protected with auth middleware)
app.route("/api/households", householdsRoutes);
app.route("/api/shopping-lists", shoppingListsRoutes);
app.route("/api/shopping-lists", shoppingListItemsRoutes);
app.route("/api/recipes", recipesRoutes);
app.route("/api/meal-plans", mealPlansRoutes);

const port = parseInt(process.env.PORT || "3000");

logger.info({ port }, "Server started");

serve({
  fetch: app.fetch,
  port,
});
