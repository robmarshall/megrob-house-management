/**
 * User type for Better Auth
 */
export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session type for Better Auth
 */
export interface Session {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
    userAgent?: string;
  };
  user: User;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmResetPassword: (token: string, newPassword: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export interface FormError {
  field?: string;
  message: string;
}
