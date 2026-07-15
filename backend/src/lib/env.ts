/**
 * Environment variables the backend cares about at boot.
 *
 * REQUIRED_ENV_VARS are core config the server cannot run without — a missing
 * value here is fatal (the process exits). SMTP config lives in EMAIL_ENV_VARS
 * instead: it only powers password-reset emails, so a missing value degrades
 * that one feature rather than taking down the whole API. index.ts warns (does
 * not exit) when EMAIL_ENV_VARS are absent.
 *
 * Note: SMTP_SECURE is intentionally excluded because email.ts has a safe
 * default for it (`process.env.SMTP_SECURE === "true"` -> false when unset).
 */
export const REQUIRED_ENV_VARS: string[] = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "FRONTEND_URL",
];

/**
 * SMTP config used to deliver password-reset emails. These are NOT boot-fatal:
 * when unset the server still starts and everything except password-reset email
 * delivery works. Set all of them to enable password-reset emails.
 */
export const EMAIL_ENV_VARS: string[] = [
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
