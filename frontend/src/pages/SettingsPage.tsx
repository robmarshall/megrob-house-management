import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { MainLayout } from '@/components/templates/MainLayout'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'
import { NutritionProfileSection } from '@/components/organisms/NutritionProfileSection'
import { TelegramNotificationsSection } from '@/components/organisms/TelegramNotificationsSection'
import { SnozoneCollectorSection } from '@/components/organisms/SnozoneCollectorSection'
import { useNotificationSettings } from '@/hooks/notifications/useNotificationSettings'
import { toast } from '@/lib/toast'
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileFormData,
  type ChangePasswordFormData,
} from '@/lib/schemas'

type ThemePreference = 'light' | 'dark' | 'system'

function ProfileSection() {
  const { user, updateProfile } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const methods = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: '',
    },
    values: user ? { name: user.name ?? '' } : undefined,
  })

  const onSubmit = async (data: UpdateProfileFormData) => {
    setFormError(null)
    try {
      await updateProfile(data.name)
      toast.success('Profile updated successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile'
      setFormError(message)
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <p className="text-sm text-gray-500">Email</p>
          <p className="text-gray-900">{user?.email}</p>
        </div>

        {user?.createdAt && (
          <div className="mb-6">
            <p className="text-sm text-gray-500">Member since</p>
            <p className="text-gray-900">
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        )}

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
            <Input
              name="name"
              label="Display Name"
              required
              autoComplete="name"
              disabled={methods.formState.isSubmitting}
            />

            {formError && <ErrorMessage message={formError} />}

            <Button
              type="submit"
              isLoading={methods.formState.isSubmitting}
              disabled={!methods.formState.isDirty}
            >
              Save Changes
            </Button>
          </form>
        </FormProvider>
      </div>
    </section>
  )
}

function ChangePasswordSection() {
  const { changePassword } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const methods = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: ChangePasswordFormData) => {
    setFormError(null)
    try {
      await changePassword(data.currentPassword, data.newPassword)
      toast.success('Password changed successfully')
      methods.reset()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to change password'
      setFormError(message)
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
            <Input
              name="currentPassword"
              label="Current Password"
              type="password"
              required
              autoComplete="current-password"
              disabled={methods.formState.isSubmitting}
            />

            <Input
              name="newPassword"
              label="New Password"
              type="password"
              required
              autoComplete="new-password"
              disabled={methods.formState.isSubmitting}
            />

            <Input
              name="confirmPassword"
              label="Confirm New Password"
              type="password"
              required
              autoComplete="new-password"
              disabled={methods.formState.isSubmitting}
            />

            {formError && <ErrorMessage message={formError} />}

            <Button type="submit" isLoading={methods.formState.isSubmitting}>
              Change Password
            </Button>
          </form>
        </FormProvider>
      </div>
    </section>
  )
}

function AppSettingsSection() {
  const options: { value: ThemePreference; label: string; description: string }[] = [
    { value: 'light', label: 'Light', description: 'Always use light theme' },
    { value: 'dark', label: 'Dark', description: 'Always use dark theme' },
    { value: 'system', label: 'System', description: 'Follow your device settings' },
  ]

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">App Settings</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <label className="block text-sm font-medium text-gray-700">Theme Preference</label>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              Coming soon
            </span>
          </div>
          <div className="flex gap-3">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled
                aria-disabled="true"
                className="flex-1 cursor-not-allowed rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-400 transition-colors disabled:opacity-60"
              >
                <div>{option.label}</div>
                <div className="text-xs font-normal text-gray-400 mt-1">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Theme switching will be fully supported in a future update.
          </p>
        </div>
      </div>
    </section>
  )
}

type TabId = 'account' | 'notifications' | 'snozone'

/**
 * Settings, tabbed.
 *
 * The admin tabs are driven by whether the notification settings query
 * resolves: it returns null on a 403, so a non-admin sees only Account and no
 * tab strip at all. The API is the real gate — this just avoids showing tabs
 * that would only ever render an error.
 */
export function SettingsPage() {
  const [tab, setTab] = useState<TabId>('account')
  const { data: notificationSettings } = useNotificationSettings()
  const isAdmin = Boolean(notificationSettings)

  const tabs: { id: TabId; label: string }[] = [
    { id: 'account', label: 'Account' },
    ...(isAdmin
      ? ([
          { id: 'notifications', label: 'Notifications' },
          { id: 'snozone', label: 'Snozone' },
        ] as { id: TabId; label: string }[])
      : []),
  ]

  // Snozone shows tables; give it room without widening the whole page.
  const width = tab === 'snozone' ? 'max-w-4xl' : 'max-w-2xl'
  const active = tabs.some((t) => t.id === tab) ? tab : 'account'

  return (
    <MainLayout>
      <div className={`${width} mx-auto`}>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {tabs.length > 1 && (
          <div className="mb-8 border-b border-gray-200">
            <nav className="-mb-px flex gap-6" aria-label="Settings sections">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={active === t.id ? 'page' : undefined}
                  className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                    active === t.id
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {active === 'account' && (
          <div className="space-y-8">
            <ProfileSection />
            <NutritionProfileSection />
            <ChangePasswordSection />
            <AppSettingsSection />
          </div>
        )}

        {active === 'notifications' && <TelegramNotificationsSection />}

        {active === 'snozone' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Snozone availability collector
              </h2>
              <p className="text-sm text-gray-500">
                Polls slot availability every 30 minutes. This data cannot be
                backfilled, so a gap here is permanent.
              </p>
            </div>
            <SnozoneCollectorSection />
          </div>
        )}
      </div>
    </MainLayout>
  )
}
