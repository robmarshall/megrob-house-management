import { Hono } from 'hono';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { validateBody, getValidatedBody } from '../middleware/validation.js';
import {
  updateTelegramSettingsSchema,
  type UpdateTelegramSettingsInput,
} from '../lib/validation.js';
import {
  getMaskedSettings,
  updateTelegramSettings,
  sendTelegramTest,
} from '../services/notificationService.js';
import { logger } from '../lib/logger.js';

/**
 * App-wide notification settings. ADMIN ONLY — this is where the Telegram bot
 * token lives, and a bot token is a credential.
 *
 * The token is never returned by any route here. Reads get a masked hint
 * ('••••0aBc') so the owner can tell which token is stored without the value
 * being recoverable from the API.
 */
const app = new Hono();

app.use('*', authMiddleware);
app.use('*', adminOnly);

/** Current settings, masked. */
app.get('/', async (c) => {
  return c.json(await getMaskedSettings());
});

/**
 * Update settings. The token is verified against Telegram's getMe before being
 * stored, so a typo fails here rather than silently swallowing the first alert.
 */
app.patch('/', validateBody(updateTelegramSettingsSchema), async (c) => {
  const input = getValidatedBody<UpdateTelegramSettingsInput>(c);
  const result = await updateTelegramSettings(input, getUserId(c));

  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ...(await getMaskedSettings()), botUsername: result.botUsername });
});

/** Send a test message to the configured chat. */
app.post('/test', async (c) => {
  const result = await sendTelegramTest();
  if (!result.ok) {
    logger.warn({ err: result.error }, 'Telegram test message failed');
    return c.json({ error: result.error }, 400);
  }
  return c.json({ ok: true });
});

export default app;
