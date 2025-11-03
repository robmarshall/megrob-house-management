import { AuthError } from '@supabase/supabase-js';

export const getAuthErrorMessage = (error: unknown): string => {
  if (error instanceof AuthError) {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password. Please try again.';
      case 'Email not confirmed':
        return 'Please confirm your email before logging in.';
      case 'User not found':
        return 'No account found with this email address.';
      case 'Email rate limit exceeded':
        return 'Too many requests. Please try again later.';
      default:
        return error.message || 'An authentication error occurred';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};
