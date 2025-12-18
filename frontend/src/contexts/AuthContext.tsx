import { createContext, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import type { AuthContextType, User, Session } from "@/types/auth";

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Use Better Auth's useSession hook for session state
  const { data: sessionData, isPending: loading } = authClient.useSession();

  // Extract user and session from Better Auth response
  const user: User | null = sessionData?.user
    ? {
        id: sessionData.user.id,
        name: sessionData.user.name,
        email: sessionData.user.email,
        emailVerified: sessionData.user.emailVerified,
        image: sessionData.user.image,
        createdAt: new Date(sessionData.user.createdAt),
        updatedAt: new Date(sessionData.user.updatedAt),
      }
    : null;

  const session: Session | null = sessionData
    ? {
        session: {
          id: sessionData.session.id,
          userId: sessionData.session.userId,
          token: sessionData.session.token,
          expiresAt: new Date(sessionData.session.expiresAt),
          createdAt: new Date(sessionData.session.createdAt),
          updatedAt: new Date(sessionData.session.updatedAt),
          ipAddress: sessionData.session.ipAddress ?? undefined,
          userAgent: sessionData.session.userAgent ?? undefined,
        },
        user: user!,
      }
    : null;

  const signIn = async (email: string, password: string) => {
    const result = await authClient.signIn.email({
      email,
      password,
    });

    if (result.error) {
      throw new Error(result.error.message || "Sign in failed");
    }
  };

  const signOut = async () => {
    const result = await authClient.signOut();

    if (result.error) {
      throw new Error(result.error.message || "Sign out failed");
    }
  };

  const resetPassword = async (email: string) => {
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${import.meta.env.VITE_FRONTEND_URL}/reset-password`,
    });

    if (result.error) {
      throw new Error(result.error.message || "Password reset request failed");
    }
  };

  const confirmResetPassword = async (token: string, newPassword: string) => {
    const result = await authClient.resetPassword({
      token,
      newPassword,
    });

    if (result.error) {
      throw new Error(result.error.message || "Password reset failed");
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut,
    resetPassword,
    confirmResetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
