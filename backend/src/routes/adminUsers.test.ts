import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user, account, session } from '../db/schema.js';
import { auth } from '../lib/auth.js';

/**
 * DB-backed test for the admin password-reset route.
 *
 * authMiddleware is mocked so the test can act as whichever user it likes;
 * adminOnly is real and reads the user's email from the DB, so the allowlist
 * gate is exercised for real. Uses the dedicated test database via
 * vitest.config.ts, same as the other DB-backed suites.
 */

const acting = vi.hoisted(() => ({ userId: '' }));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('userId', acting.userId);
    await next();
  },
  getUserId: (c: any) => c.get('userId'),
}));

const { default: adminUsersRoutes } = await import('./adminUsers.js');

const RUN = `adminusers_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const ADMIN = `${RUN}_admin`;
const MEMBER = `${RUN}_member`;
const NO_CREDENTIAL = `${RUN}_nocred`;
const ADMIN_EMAIL = `${ADMIN}@test.local`;

const OLD_PASSWORD = 'old-password-1';
const NEW_PASSWORD = 'temp-password-2';

function post(id: string, body: unknown) {
  return adminUsersRoutes.request(`/${id}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function credentialHash(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(eq(account.userId, userId));
  return row?.password ?? null;
}

async function cleanup() {
  await db.execute(sql`TRUNCATE TABLE ${user} RESTART IDENTITY CASCADE`);
}

beforeAll(async () => {
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  await cleanup();

  await db.insert(user).values([
    { id: ADMIN, name: 'Admin', email: ADMIN_EMAIL },
    { id: MEMBER, name: 'Member', email: `${MEMBER}@test.local` },
    { id: NO_CREDENTIAL, name: 'Invited', email: `${NO_CREDENTIAL}@test.local` },
  ]);

  const ctx = await auth.$context;
  await db.insert(account).values({
    id: `${RUN}_member_account`,
    accountId: MEMBER,
    providerId: 'credential',
    userId: MEMBER,
    password: await ctx.password.hash(OLD_PASSWORD),
  });

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(session).values([
    { id: `${RUN}_s1`, token: `${RUN}_t1`, userId: MEMBER, expiresAt },
    { id: `${RUN}_s2`, token: `${RUN}_t2`, userId: MEMBER, expiresAt },
    { id: `${RUN}_s3`, token: `${RUN}_t3`, userId: ADMIN, expiresAt },
  ]);
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/admin/users', () => {
  it('is forbidden to a non-admin', async () => {
    acting.userId = MEMBER;
    const res = await adminUsersRoutes.request('/');
    expect(res.status).toBe(403);
  });

  it('lists every user with the allowlist flag for an admin', async () => {
    acting.userId = ADMIN;
    const res = await adminUsersRoutes.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; isAdmin: boolean; email: string }[];
    const byId = Object.fromEntries(body.map((u) => [u.id, u]));
    expect(byId[ADMIN]?.isAdmin).toBe(true);
    expect(byId[MEMBER]?.isAdmin).toBe(false);
    expect(byId[NO_CREDENTIAL]?.isAdmin).toBe(false);
  });
});

describe('POST /api/admin/users/:id/password', () => {
  it('is forbidden to a non-admin', async () => {
    acting.userId = MEMBER;
    const res = await post(ADMIN, { newPassword: NEW_PASSWORD });
    expect(res.status).toBe(403);
    // And nothing happened to the target.
    expect(await credentialHash(ADMIN)).toBeNull();
  });

  it('rejects a password that is too short', async () => {
    acting.userId = ADMIN;
    const res = await post(MEMBER, { newPassword: 'abc' });
    expect(res.status).toBe(400);
  });

  it("refuses to reset the admin's own password", async () => {
    acting.userId = ADMIN;
    const res = await post(ADMIN, { newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(await credentialHash(ADMIN)).toBeNull();
  });

  it('404s for an unknown user', async () => {
    acting.userId = ADMIN;
    const res = await post(`${RUN}_nobody`, { newPassword: NEW_PASSWORD });
    expect(res.status).toBe(404);
  });

  it("replaces the password and revokes only the target's sessions", async () => {
    acting.userId = ADMIN;
    const before = await credentialHash(MEMBER);

    const res = await post(MEMBER, { newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);

    const after = await credentialHash(MEMBER);
    expect(after).not.toBe(before);

    const ctx = await auth.$context;
    expect(await ctx.password.verify({ hash: after!, password: NEW_PASSWORD })).toBe(true);
    expect(await ctx.password.verify({ hash: after!, password: OLD_PASSWORD })).toBe(false);

    const memberSessions = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, MEMBER));
    expect(memberSessions).toHaveLength(0);

    const adminSessions = await db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, ADMIN));
    expect(adminSessions).toHaveLength(1);
  });

  it('creates a credential account for a user who has none', async () => {
    acting.userId = ADMIN;
    expect(await credentialHash(NO_CREDENTIAL)).toBeNull();

    const res = await post(NO_CREDENTIAL, { newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);

    const rows = await db
      .select({ providerId: account.providerId, password: account.password })
      .from(account)
      .where(eq(account.userId, NO_CREDENTIAL));
    expect(rows).toHaveLength(1);
    expect(rows[0].providerId).toBe('credential');

    const ctx = await auth.$context;
    expect(
      await ctx.password.verify({ hash: rows[0].password!, password: NEW_PASSWORD })
    ).toBe(true);
  });
});
