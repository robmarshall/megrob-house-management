import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notificationSettings } from '../db/schema.js';
import { seal, open, maskSecret, isEncryptionConfigured } from '../lib/secretBox.js';
import { getBotInfo, sendMessage, TelegramError } from '../lib/telegram.js';
import { logger } from '../lib/logger.js';

/**
 * Outbound notifications, configured from the settings page rather than the
 * environment so the channel can be changed without a redeploy.
 *
 * The bot token is sealed at rest and never leaves this module in the clear:
 * reads for the API go through `getMaskedSettings`, and the only code path that
 * unseals it hands it straight to the Telegram client.
 */

const SETTINGS_ID = 1;

export interface MaskedNotificationSettings {
  telegramEnabled: boolean;
  /** '••••0aBc', or null when no token is stored. */
  telegramTokenHint: string | null;
  telegramChatId: string | null;
  telegramBotUsername: string | null;
  lastVerifiedAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  updatedAt: Date | null;
  /** False when SETTINGS_ENCRYPTION_KEY is unset — nothing can be saved. */
  encryptionConfigured: boolean;
}

async function loadRow() {
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.id, SETTINGS_ID))
    .limit(1);
  return row ?? null;
}

/** API-safe view. Never includes the token. */
export async function getMaskedSettings(): Promise<MaskedNotificationSettings> {
  const row = await loadRow();
  const encryptionConfigured = isEncryptionConfigured();

  if (!row) {
    return {
      telegramEnabled: false,
      telegramTokenHint: null,
      telegramChatId: null,
      telegramBotUsername: null,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastError: null,
      updatedAt: null,
      encryptionConfigured,
    };
  }

  let hint: string | null = null;
  if (row.telegramBotTokenCipher) {
    try {
      hint = maskSecret(open(row.telegramBotTokenCipher));
    } catch {
      // Key rotated or value corrupted: say so plainly rather than pretending
      // a working token is stored.
      hint = '(unreadable — encryption key changed?)';
    }
  }

  return {
    telegramEnabled: row.telegramEnabled,
    telegramTokenHint: hint,
    telegramChatId: row.telegramChatId,
    telegramBotUsername: row.telegramBotUsername,
    lastVerifiedAt: row.lastVerifiedAt,
    lastErrorAt: row.lastErrorAt,
    lastError: row.lastError,
    updatedAt: row.updatedAt,
    encryptionConfigured,
  };
}

export interface UpdateTelegramInput {
  /** Omit or leave blank to keep the stored token. */
  botToken?: string;
  chatId?: string;
  enabled?: boolean;
}

export interface UpdateResult {
  ok: boolean;
  botUsername?: string;
  error?: string;
}

/**
 * Save Telegram settings, verifying the token with Telegram before storing it.
 *
 * Verifying first means a typo is rejected at the point of entry rather than
 * discovered weeks later when the first alert silently fails to arrive.
 */
export async function updateTelegramSettings(
  input: UpdateTelegramInput,
  userId: string
): Promise<UpdateResult> {
  if (!isEncryptionConfigured()) {
    return {
      ok: false,
      error:
        'SETTINGS_ENCRYPTION_KEY is not set on the server, so the bot token cannot ' +
        'be stored securely. Generate one with: openssl rand -base64 32',
    };
  }

  const existing = await loadRow();
  const submitted = input.botToken?.trim();

  let cipher = existing?.telegramBotTokenCipher ?? null;
  let token: string | null = null;

  if (submitted) {
    token = submitted;
    cipher = seal(submitted);
  } else if (cipher) {
    try {
      token = open(cipher);
    } catch {
      return { ok: false, error: 'Stored token is unreadable; re-enter it.' };
    }
  }

  const chatId = input.chatId?.trim() || existing?.telegramChatId || null;
  const enabled = input.enabled ?? existing?.telegramEnabled ?? false;

  // Only verify when there is something to verify against.
  let botUsername = existing?.telegramBotUsername ?? null;
  // A successful save clears any previously recorded send error.
  const lastError: string | null = null;
  let verifiedAt: Date | null = existing?.lastVerifiedAt ?? null;

  if (token) {
    try {
      const info = await getBotInfo(token);
      botUsername = info.username;
      verifiedAt = new Date();
    } catch (err) {
      const message = err instanceof TelegramError ? err.message : 'verification failed';
      logger.warn({ err: message }, 'Telegram token verification failed');
      return { ok: false, error: `Telegram rejected the token: ${message}` };
    }
  }

  if (enabled && (!token || !chatId)) {
    return { ok: false, error: 'A bot token and chat ID are both required to enable Telegram.' };
  }

  const values = {
    id: SETTINGS_ID,
    telegramEnabled: enabled,
    telegramBotTokenCipher: cipher,
    telegramChatId: chatId,
    telegramBotUsername: botUsername,
    lastVerifiedAt: verifiedAt,
    lastError,
    lastErrorAt: lastError ? new Date() : existing?.lastErrorAt ?? null,
    updatedAt: new Date(),
    updatedBy: userId,
  };

  await db
    .insert(notificationSettings)
    .values(values)
    .onConflictDoUpdate({ target: notificationSettings.id, set: values });

  logger.info({ userId, enabled, botUsername }, 'Telegram settings updated');
  return { ok: true, botUsername: botUsername ?? undefined };
}

async function recordSendFailure(message: string): Promise<void> {
  await db
    .update(notificationSettings)
    .set({ lastError: message, lastErrorAt: new Date() })
    .where(eq(notificationSettings.id, SETTINGS_ID));
}

/**
 * Send a notification. NEVER THROWS.
 *
 * Callers are background jobs reporting that something already went wrong; an
 * alert that throws would take down the job it was reporting on. Returns
 * whether it was delivered, and always leaves a copy in the logs so an
 * undelivered alert is never a silent one.
 */
export async function notify(subject: string, lines: string[] = []): Promise<boolean> {
  const text = [subject, ...lines].join('\n');

  try {
    const row = await loadRow();
    if (!row?.telegramEnabled || !row.telegramBotTokenCipher || !row.telegramChatId) {
      logger.warn({ subject, lines }, 'ALERT (Telegram not configured; logged only)');
      return false;
    }

    const token = open(row.telegramBotTokenCipher);
    await sendMessage(token, row.telegramChatId, text);
    logger.info({ subject }, 'Alert sent via Telegram');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, subject, lines }, 'ALERT (Telegram send failed; logged only)');
    try {
      await recordSendFailure(message);
    } catch {
      // Recording the failure is best-effort; the log above is the real record.
    }
    return false;
  }
}

/** Send a test message on demand from the settings page. */
export async function sendTelegramTest(): Promise<UpdateResult> {
  const row = await loadRow();
  if (!row?.telegramBotTokenCipher || !row.telegramChatId) {
    return { ok: false, error: 'Save a bot token and chat ID first.' };
  }

  try {
    const token = open(row.telegramBotTokenCipher);
    await sendMessage(
      token,
      row.telegramChatId,
      'Test from Home Management — Telegram notifications are working.'
    );
    await db
      .update(notificationSettings)
      .set({ lastVerifiedAt: new Date(), lastError: null, lastErrorAt: null })
      .where(eq(notificationSettings.id, SETTINGS_ID));
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSendFailure(message).catch(() => undefined);
    return { ok: false, error: message };
  }
}
