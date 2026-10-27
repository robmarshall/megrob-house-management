import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { auth } from '../lib/auth.js';
import { isAdminEmail } from '../middleware/adminOnly.js';
import { logger } from '../lib/logger.js';

/**
 * Admin user management.
 *
 * There is no forgot-password email flow (no email provider is paid for), so
 * when a household member locks themselves out the app owner sets them a
 * temporary password here and hands it over out of band. This goes through
 * Better Auth's own context so the hash format and the credential-account
 * lookup stay whatever the installed version expects, rather than duplicating
 * the scrypt parameters a second time (seedHelpers already does once, for the
 * one-off seed).
 */

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  /** On the ADMIN_EMAILS allowlist. Informational; the API is the real gate. */
  isAdmin: boolean;
}

export async function listUsers(): Promise<AdminUserSummary[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.createdAt), asc(user.id));

  return rows.map((row) => ({ ...row, isAdmin: isAdminEmail(row.email) }));
}

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; status: 400 | 404; error: string };

/**
 * Overwrite a user's password and revoke every session they hold.
 *
 * Revoking sessions is the point, not a nicety: a reset that leaves the old
 * credential holder logged in has not actually locked anyone out.
 *
 * An admin may not reset their own password this way. Change-password requires
 * the current password, and this must not become a route around that check.
 */
export async function setUserPassword(
  targetUserId: string,
  newPassword: string,
  adminUserId: string
): Promise<SetPasswordResult> {
  if (targetUserId === adminUserId) {
    return {
      ok: false,
      status: 400,
      error: 'Use Change Password on the Account tab to change your own password',
    };
  }

  const [target] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  if (!target) {
    return { ok: false, status: 404, error: 'User not found' };
  }

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);

  // updatePassword only touches an existing credential account. A user created
  // by other means (an invite, say) has none yet, so create one rather than
  // silently updating zero rows.
  const accounts = await ctx.internalAdapter.findAccounts(target.id);
  const credential = accounts.find((a) => a.providerId === 'credential');

  if (credential) {
    await ctx.internalAdapter.updatePassword(target.id, hash);
  } else {
    await ctx.internalAdapter.createAccount({
      userId: target.id,
      accountId: target.id,
      providerId: 'credential',
      password: hash,
    });
  }

  await ctx.internalAdapter.deleteSessions(target.id);

  logger.info(
    { adminUserId, targetUserId: target.id },
    'Admin reset a user password and revoked their sessions'
  );

  return { ok: true };
}
