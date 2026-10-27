/**
 * Admin user management (admin only).
 */
export interface AdminUser {
  id: string
  name: string
  email: string
  createdAt: string
  /** On the server's ADMIN_EMAILS allowlist. Informational only. */
  isAdmin: boolean
}

export interface SetUserPasswordInput {
  userId: string
  newPassword: string
}
