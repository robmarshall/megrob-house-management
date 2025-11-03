import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema, type LoginFormData } from '@/lib/schemas'
import { FormField } from '@/components/molecules/FormField'
import { Button } from '@/components/atoms/Button'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'

export function LoginForm() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    setFormError(null)

    try {
      await signIn(data.email, data.password)
      navigate('/')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to sign in')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormField
        label="Email"
        type="email"
        error={errors.email?.message}
        required
        autoComplete="email"
        disabled={isSubmitting}
        {...register('email')}
      />

      <FormField
        label="Password"
        type="password"
        error={errors.password?.message}
        required
        autoComplete="current-password"
        disabled={isSubmitting}
        {...register('password')}
      />

      {formError && <ErrorMessage message={formError} />}

      <div className="flex flex-col gap-4">
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Sign In
        </Button>

        <Link
          to="/reset-password"
          className="text-sm text-primary-600 hover:text-primary-700 text-center"
        >
          Forgot your password?
        </Link>
      </div>
    </form>
  )
}
