import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { Checkbox } from '@/components/atoms/Checkbox'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'
import { toast } from '@/lib/toast'
import { telegramSettingsSchema, type TelegramSettingsFormData } from '@/lib/schemas'
import {
  useNotificationSettings,
  useSaveNotificationSettings,
  useSendTestNotification,
} from '@/hooks/notifications/useNotificationSettings'
import { ApiError } from '@/lib/api/ApiError'

/**
 * Telegram notification settings. Admin only — the API returns 403 to everyone
 * else and the hook maps that to null, so this section simply does not render
 * rather than showing a form that cannot be submitted.
 *
 * The bot token is write-only from the browser's point of view: the server
 * returns a masked hint, never the value, so leaving the field blank keeps
 * whatever is stored.
 */
export function TelegramNotificationsSection() {
  const { data: settings, isLoading } = useNotificationSettings()
  const save = useSaveNotificationSettings()
  const test = useSendTestNotification()
  const [error, setError] = useState<string | null>(null)

  const methods = useForm<TelegramSettingsFormData>({
    resolver: zodResolver(telegramSettingsSchema),
    values: {
      botToken: '',
      chatId: settings?.telegramChatId ?? '',
      enabled: settings?.telegramEnabled ?? false,
    },
  })

  // Loading, or not an admin.
  if (isLoading || !settings) return null

  const hasToken = Boolean(settings.telegramTokenHint)

  const onSubmit = async (data: TelegramSettingsFormData) => {
    setError(null)
    try {
      await save.mutateAsync({
        // Blank means "keep the stored token" — never send an empty string.
        botToken: data.botToken?.trim() || undefined,
        chatId: data.chatId?.trim() || undefined,
        enabled: data.enabled,
      })
      methods.resetField('botToken')
      toast.success('Notification settings saved')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not save settings'
      setError(message)
    }
  }

  const onTest = async () => {
    setError(null)
    try {
      await test.mutateAsync()
      toast.success('Test message sent — check Telegram')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not send test message'
      setError(message)
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Notifications</h2>
      <p className="text-sm text-gray-500 mb-4">
        Send alerts to Telegram — used for background job failures, such as the
        Snozone availability collector.
      </p>

      {!settings.encryptionConfigured && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The server has no <code>SETTINGS_ENCRYPTION_KEY</code>, so the bot
          token cannot be stored securely and settings cannot be saved. Generate
          one with <code>openssl rand -base64 32</code> and set it in the
          backend environment.
        </div>
      )}

      <StatusLine settings={settings} />

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
          <Input
            name="botToken"
            label="Bot token"
            placeholder={hasToken ? `Stored ${settings.telegramTokenHint} — leave blank to keep` : '123456:ABC-DEF...'}
            description="From @BotFather on Telegram. Only sent when you change it; never shown again."
            disabled={!settings.encryptionConfigured}
            inputProps={{ type: 'password', autoComplete: 'off' }}
          />

          <Input
            name="chatId"
            label="Chat ID"
            placeholder="e.g. 123456789"
            description="Message your bot, then open @userinfobot to get your numeric chat ID. A group chat ID starts with -."
            disabled={!settings.encryptionConfigured}
          />

          <Checkbox
            id="telegram-enabled"
            name="enabled"
            label="Send alerts to Telegram"
            disabled={!settings.encryptionConfigured}
          />

          {error && <ErrorMessage message={error} />}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={save.isPending || !settings.encryptionConfigured}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onTest}
              disabled={test.isPending || !hasToken || !settings.telegramChatId}
            >
              {test.isPending ? 'Sending…' : 'Send test message'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </section>
  )
}

function StatusLine({
  settings,
}: {
  settings: NonNullable<ReturnType<typeof useNotificationSettings>['data']>
}) {
  const parts: string[] = []
  if (settings.telegramBotUsername) parts.push(`Connected to @${settings.telegramBotUsername}`)
  if (settings.lastVerifiedAt) {
    parts.push(`last verified ${new Date(settings.lastVerifiedAt).toLocaleString()}`)
  }

  return (
    <div className="mb-4 space-y-2 text-sm">
      {parts.length > 0 && <p className="text-gray-600">{parts.join(' · ')}</p>}

      {settings.lastError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          <p className="font-medium">Last send failed</p>
          <p className="mt-1 break-words">{settings.lastError}</p>
          {settings.lastErrorAt && (
            <p className="mt-1 text-xs text-red-600">
              {new Date(settings.lastErrorAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
