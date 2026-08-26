import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { getUserId } from './auth.js';
import { logger } from '../lib/logger.js';

/**
 * Restrict a route to the app owner.
 *
 * megrob has no admin role — `householdMembers.role` is household-scoped, not
 * app-wide — so rather than invent one in the schema, this gates on an
 * env-configured email allowlist. Signup is disabled and the account set is
 * tiny, so a list of addresses is proportionate to the problem.
 *
 * ADMIN_EMAILS: comma-separated. Falls back to SEED_ADMIN_EMAIL, which already
 * names the sole provisioned account.
 *
 * FAILS CLOSED. With no allowlist configured nobody is an admin, because the
 * alternative default — an empty list meaning "everyone" — would silently
 * expose the settings that hold the bot token. Must run AFTER authMiddleware.
 */

export function adminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.ADMIN_EMAILS || env.SEED_ADMIN_EMAIL || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAdminEmail(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!email) return false;
  const allow = adminEmails(env);
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}

export async function adminOnly(c: Context, next: Next) {
  const userId = getUserId(c);

  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!isAdminEmail(row?.email)) {
    if (adminEmails().length === 0) {
      logger.error(
        'ADMIN_EMAILS (or SEED_ADMIN_EMAIL) is not set; admin routes are denied to everyone'
      );
    } else {
      logger.warn({ userId }, 'Non-admin attempted an admin-only route');
    }
    // Same response either way: whether an allowlist exists is not something
    // an unauthorised caller needs to learn.
    return c.json({ error: 'Forbidden' }, 403);
  }

  await next();
}
