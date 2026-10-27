import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import BottomSheet from '@/components/atoms/BottomSheet'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'
import { useAuth } from '@/hooks/useAuth'
import { useAdminUsers, useSetUserPassword } from '@/hooks/admin/useAdminUsers'
import { ApiError } from '@/lib/api/ApiError'
import { toast } from '@/lib/toast'
import { adminSetPasswordSchema, type AdminSetPasswordFormData } from '@/lib/schemas'
import type { AdminUser } from '@/types/admin'

/**
 * Admin user list with password reset. Admin only — the API returns 403 to
 * everyone else and the hook maps that to null, so this section simply does
 * not render.
 *
 * This stands in for a forgot-password email flow: the admin sets a temporary
 * password, tells the user out of band, and the user changes it from their
 * own Account tab. The server logs the user out everywhere on reset.
 */
export function AdminUsersSection() {
  const { user: me } = useAuth()
  const { data: users, isLoading, isError } = useAdminUsers()
  const [target, setTarget] = useState<AdminUser | null>(null)

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading users…</p>
  }
  if (isError) {
    return <p className="text-sm text-red-600">Could not load users.</p>
  }
  if (!users) return null

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Users</h2>
      <p className="text-sm text-gray-500 mb-4">
        There is no forgot-password email. If someone is locked out, set them
        a temporary password here and tell them directly. They are signed out
        everywhere and should change it from their own Account tab.
      </p>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {users.map((u) => {
          const isMe = u.id === me?.id
          return (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  {u.name}
                  {isMe && (
                    <span className="ml-2 text-xs font-normal text-gray-500">(you)</span>
                  )}
                  {u.isAdmin && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                      Admin
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-gray-500">{u.email}</p>
              </div>
              {!isMe && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTarget(u)}
                  aria-label={`Reset password for ${u.name}`}
                >
                  Reset password
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      <ResetPasswordSheet target={target} onClose={() => setTarget(null)} />
    </section>
  )
}

function ResetPasswordSheet({
  target,
  onClose,
}: {
  target: AdminUser | null
  onClose: () => void
}) {
  const setPassword = useSetUserPassword()
  const [error, setError] = useState<string | null>(null)

  const methods = useForm<AdminSetPasswordFormData>({
    resolver: zodResolver(adminSetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  const close = () => {
    if (setPassword.isPending) return
    methods.reset()
    setError(null)
    onClose()
  }

  const onSubmit = async (data: AdminSetPasswordFormData) => {
    if (!target) return
    setError(null)
    try {
      await setPassword.mutateAsync({ userId: target.id, newPassword: data.newPassword })
      toast.success(`Password reset for ${target.name}. They have been signed out everywhere.`)
      methods.reset()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password')
    }
  }

  return (
    <BottomSheet
      isOpen={target !== null}
      onClose={close}
      title={target ? `Reset password for ${target.name}` : 'Reset password'}
    >
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-gray-600">
            Choose a temporary password for{' '}
            <span className="font-medium">{target?.email}</span>. Their current
            sessions will be revoked.
          </p>

          <Input
            name="newPassword"
            label="Temporary password"
            type="password"
            required
            autoComplete="off"
            disabled={setPassword.isPending}
          />

          <Input
            name="confirmPassword"
            label="Confirm temporary password"
            type="password"
            required
            autoComplete="off"
            disabled={setPassword.isPending}
          />

          {error && <ErrorMessage message={error} />}

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={setPassword.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={setPassword.isPending}>
              Reset password
            </Button>
          </div>
        </form>
      </FormProvider>
    </BottomSheet>
  )
}
