import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema, type LoginFormData } from '@/lib/schemas'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'

export function LoginForm() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const methods = useForm<LoginFormData>({
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
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        <Input
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          disabled={methods.formState.isSubmitting}
        />

        <Input
          name="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          disabled={methods.formState.isSubmitting}
        />

        {formError && <ErrorMessage message={formError} />}

        <div className="flex flex-col gap-4">
          <Button type="submit" isLoading={methods.formState.isSubmitting} className="w-full">
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
    </FormProvider>
  )
}
