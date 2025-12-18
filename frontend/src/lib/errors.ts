/**
 * Get a user-friendly error message from various error types
 */
export const getAuthErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Better Auth error messages
    const message = error.message.toLowerCase();

    if (
      message.includes("invalid") &&
      (message.includes("email") || message.includes("password"))
    ) {
      return "Invalid email or password. Please try again.";
    }

    if (message.includes("not found") || message.includes("user not found")) {
      return "No account found with this email address.";
    }

    if (message.includes("rate limit") || message.includes("too many")) {
      return "Too many requests. Please try again later.";
    }

    if (message.includes("expired")) {
      return "Your session has expired. Please log in again.";
    }

    if (message.includes("token") && message.includes("invalid")) {
      return "Invalid or expired reset token. Please request a new password reset.";
    }

    return error.message || "An authentication error occurred";
  }

  return "An unexpected error occurred. Please try again.";
};
