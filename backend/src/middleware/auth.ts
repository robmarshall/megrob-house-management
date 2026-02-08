import { Context, Next } from "hono";
import { auth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

/**
 * Authentication middleware that validates Better Auth sessions
 * and attaches the authenticated user ID to the request context
 */
export async function authMiddleware(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Attach user ID and session to the context for use in route handlers
    c.set("userId", session.user.id);
    c.set("session", session);
    c.set("user", session.user);

    await next();
  } catch (error) {
    logger.error({ err: error }, "Auth middleware error");
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

/**
 * Type helper to get the full session from context
 */
export function getSession(c: Context) {
  const session = c.get("session");
  if (!session) {
    throw new Error(
      "Session not found in context. Ensure authMiddleware is applied."
    );
  }
  return session;
}
