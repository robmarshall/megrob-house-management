import { Hono } from 'hono';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { validateBody, getValidatedBody } from '../middleware/validation.js';
import {
  adminSetPasswordSchema,
  type AdminSetPasswordInput,
} from '../lib/validation.js';
import { listUsers, setUserPassword } from '../services/adminUserService.js';

/**
 * Admin user management. ADMIN ONLY — gated by the same ADMIN_EMAILS allowlist
 * as the other app-wide settings.
 *
 * Exists because there is no forgot-password email flow; see
 * services/adminUserService.ts.
 */
const app = new Hono();

app.use('*', authMiddleware);
app.use('*', adminOnly);

/** Every account, oldest first. */
app.get('/', async (c) => {
  return c.json(await listUsers());
});

/**
 * Set a temporary password for another user and log them out everywhere.
 * The admin hands the password over out of band; the user changes it from
 * their own Account tab once in.
 */
app.post('/:id/password', validateBody(adminSetPasswordSchema), async (c) => {
  const { newPassword } = getValidatedBody<AdminSetPasswordInput>(c);
  const result = await setUserPassword(c.req.param('id'), newPassword, getUserId(c));

  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true });
});

export default app;
