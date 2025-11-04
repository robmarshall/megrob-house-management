import { Context, Next } from "hono";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Authentication middleware that verifies Supabase JWT tokens
 * and attaches the authenticated user ID to the request context
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return c.json({ error: "Invalid Authorization header format" }, 401);
  }

  try {
    // Verify the JWT token
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Attach user ID to the context for use in route handlers
    c.set("userId", user.id);

    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json({ error: "Authentication failed" }, 401);
  }
}

/**
 * Type helper to get the authenticated user ID from context
 */
export function getUserId(c: Context): string {
  const userId = c.get("userId");
  if (!userId) {
    throw new Error(
      "User ID not found in context. Ensure authMiddleware is applied."
    );
  }
  return userId;
}
