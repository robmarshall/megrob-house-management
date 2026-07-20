import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { authClient } from '@/lib/auth-client'
import { loginSchema, type LoginFormData } from '@/lib/schemas'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'

export function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  const redirectTo = fromPath && fromPath !== '/login' ? fromPath : '/'

  // When an MCP client starts an OAuth flow while the user is logged out, the
  // backend redirects here with the authorize query intact. After sign-in we
  // resume the flow with a top-level navigation back to the authorize endpoint
  // (our own backend, so no open-redirect surface; the redirect_uri inside the
  // query is validated server-side against the registered client).
  const oauthParams = new URLSearchParams(location.search)
  const isOAuthFlow =
    oauthParams.has('client_id') && oauthParams.has('redirect_uri')
  const resumeOAuthFlow = () => {
    window.location.assign(
      `${import.meta.env.VITE_API_URL}/api/auth/mcp/authorize?${oauthParams.toString()}`
    )
  }

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
      if (isOAuthFlow) {
        resumeOAuthFlow()
        return
      }
      navigate(redirectTo, { replace: true })
    } catch (error) {
      // During an OAuth flow the backend's mcp plugin can hijack the sign-in
      // response into a cross-origin redirect, which surfaces here as a fetch
      // error even though the session was created. Check for a live session
      // before treating it as a real failure.
      if (isOAuthFlow) {
        const session = await authClient.getSession()
        if (session.data?.session) {
          resumeOAuthFlow()
          return
        }
      }
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
