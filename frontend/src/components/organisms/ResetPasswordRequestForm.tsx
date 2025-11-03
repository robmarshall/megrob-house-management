import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { resetPasswordRequestSchema, type ResetPasswordRequestFormData } from '@/lib/schemas'
import { FormField } from '@/components/molecules/FormField'
import { Button } from '@/components/atoms/Button'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'

export function ResetPasswordRequestForm() {
  const { resetPassword } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordRequestFormData>({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSubmit = async (data: ResetPasswordRequestFormData) => {
    setFormError(null)

    try {
      await resetPassword(data.email)
      setIsSuccess(true)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to send reset email')
    }
  }

  if (isSuccess) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            Password reset email sent! Check your inbox for a link to reset your password.
          </p>
        </div>
        <Link
          to="/login"
          className="block text-sm text-primary-600 hover:text-primary-700 text-center"
        >
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <p className="text-sm text-gray-600">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      <FormField
        label="Email"
        type="email"
        error={errors.email?.message}
        required
        autoComplete="email"
        disabled={isSubmitting}
        {...register('email')}
      />

      {formError && <ErrorMessage message={formError} />}

      <div className="flex flex-col gap-4">
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Send Reset Link
        </Button>

        <Link
          to="/login"
          className="text-sm text-primary-600 hover:text-primary-700 text-center"
        >
          Back to login
        </Link>
      </div>
    </form>
  )
}
