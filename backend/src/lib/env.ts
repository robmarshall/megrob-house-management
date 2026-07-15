/**
 * Required environment variables for the backend to boot safely.
 *
 * Includes:
 * - Core app/database/auth config (DATABASE_URL also backs the pg-boss job queue)
 * - SMTP config used to deliver password-reset emails
 *
 * Note: SMTP_SECURE is intentionally excluded because email.ts has a safe
 * default for it (`process.env.SMTP_SECURE === "true"` -> false when unset).
 */
export const REQUIRED_ENV_VARS: string[] = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "FRONTEND_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
];

/**
 * Returns the names of required environment variables that are missing or
 * empty in the provided environment.
 *
 * @param required List of variable names to check (defaults to REQUIRED_ENV_VARS).
 * @param env Environment object to read from (defaults to process.env).
 * @returns Array of missing/empty variable names (empty array when all present).
 */
export function getMissingEnvVars(
  required: string[] = REQUIRED_ENV_VARS,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  return required.filter((varName) => !env[varName]);
}
