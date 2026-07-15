import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { AuthLayout } from '@/components/templates/AuthLayout'
import { LoginForm } from '@/components/organisms/LoginForm'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()

  const message = (location.state as { message?: string } | null)?.message

  // Redirect to home if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/')
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <AuthLayout title="Sign In" subtitle="Welcome back! Please sign in to continue.">
      {message && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {message}
        </div>
      )}
      <LoginForm />
    </AuthLayout>
  )
}
