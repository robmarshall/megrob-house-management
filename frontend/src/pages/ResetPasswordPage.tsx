import { useSearchParams } from "react-router";
import { AuthLayout } from "@/components/templates/AuthLayout";
import { ResetPasswordRequestForm } from "@/components/organisms/ResetPasswordRequestForm";
import { ResetPasswordConfirmForm } from "@/components/organisms/ResetPasswordConfirmForm";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();

  // Better Auth sends the token as a query parameter
  const token = searchParams.get("token");

  if (token) {
    return (
      <AuthLayout
        title="Set New Password"
        subtitle="Choose a strong password for your account."
      >
        <ResetPasswordConfirmForm token={token} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Forgot your password? No problem!"
    >
      <ResetPasswordRequestForm />
    </AuthLayout>
  );
}
