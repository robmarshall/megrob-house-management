import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { resetPasswordConfirmSchema, type ResetPasswordConfirmFormData } from '@/lib/schemas'
import { getPasswordStrength } from '@/lib/validators'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'
import { cn } from '@/lib/utils'

export function ResetPasswordConfirmForm() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const methods = useForm<ResetPasswordConfirmFormData>({
    resolver: zodResolver(resetPasswordConfirmSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const password = methods.watch('password')
  const passwordStrength = password ? getPasswordStrength(password) : null

  const onSubmit = async (data: ResetPasswordConfirmFormData) => {
    setFormError(null)

    try {
      await updatePassword(data.password)
      navigate('/login', { state: { message: 'Password updated successfully!' } })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update password')
    }
  }

  const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <p className="text-sm text-gray-600">
          Enter your new password below.
        </p>

        <div>
          <Input
            name="password"
            label="New Password"
            type="password"
            required
            autoComplete="new-password"
            disabled={methods.formState.isSubmitting}
          />
          {passwordStrength && (
            <div className="mt-2">
              <div className="flex gap-1">
                <div className={cn('h-1 flex-1 rounded', strengthColors[passwordStrength])} />
                <div className={cn('h-1 flex-1 rounded', passwordStrength !== 'weak' ? strengthColors[passwordStrength] : 'bg-gray-200')} />
                <div className={cn('h-1 flex-1 rounded', passwordStrength === 'strong' ? strengthColors[passwordStrength] : 'bg-gray-200')} />
              </div>
              <p className="text-xs text-gray-600 mt-1 capitalize">
                Password strength: {passwordStrength}
              </p>
            </div>
          )}
        </div>

        <Input
          name="confirmPassword"
          label="Confirm Password"
          type="password"
          required
          autoComplete="new-password"
          disabled={methods.formState.isSubmitting}
        />

        {formError && <ErrorMessage message={formError} />}

        <Button type="submit" isLoading={methods.formState.isSubmitting} className="w-full">
          Update Password
        </Button>
      </form>
    </FormProvider>
  )
}
