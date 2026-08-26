/**
 * App-wide notification settings (admin only).
 *
 * The bot token is never sent to the client — the API returns only
 * `telegramTokenHint`, a masked tail like '••••0aBc', so the owner can tell
 * which token is stored without it being recoverable from the browser.
 */
export interface NotificationSettings {
  telegramEnabled: boolean
  telegramTokenHint: string | null
  telegramChatId: string | null
  telegramBotUsername: string | null
  lastVerifiedAt: string | null
  lastErrorAt: string | null
  lastError: string | null
  updatedAt: string | null
  /** False when the server has no SETTINGS_ENCRYPTION_KEY: nothing can be saved. */
  encryptionConfigured: boolean
}

export interface UpdateNotificationSettings {
  /** Omit or leave blank to keep the stored token. */
  botToken?: string
  chatId?: string
  enabled?: boolean
}
