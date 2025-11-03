import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AuthLayout } from '@/components/templates/AuthLayout'
import { ResetPasswordRequestForm } from '@/components/organisms/ResetPasswordRequestForm'
import { ResetPasswordConfirmForm } from '@/components/organisms/ResetPasswordConfirmForm'

export function ResetPasswordPage() {
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    // Check if there's a recovery token in the URL
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If there's a session and it's a recovery session, show the confirm form
      if (session) {
        setHasToken(true)
      }
    })
  }, [])

  if (hasToken) {
    return (
      <AuthLayout title="Set New Password" subtitle="Choose a strong password for your account.">
        <ResetPasswordConfirmForm />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset Password" subtitle="Forgot your password? No problem!">
      <ResetPasswordRequestForm />
    </AuthLayout>
  )
}
