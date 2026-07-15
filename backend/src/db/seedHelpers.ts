import { scryptAsync } from "@noble/hashes/scrypt.js";

// Match Better Auth's exact implementation from their source code
const config = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
};

export interface SeedConfig {
  email: string;
  password: string;
  name: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
  // Generate 16-byte salt and encode as hex STRING (this is what Better Auth does)
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toHex(saltBytes);

  // Pass the hex STRING as salt (not bytes!) - this is how Better Auth does it
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: config.N,
    p: config.p,
    r: config.r,
    dkLen: config.dkLen,
    maxmem: 128 * config.N * config.r * 2,
  });

  return `${salt}:${toHex(key)}`;
}

/**
 * Resolve the seed admin credentials from environment variables.
 *
 * Requires `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to be set (non-empty).
 * `SEED_ADMIN_NAME` is optional and defaults to "Admin".
 *
 * There are intentionally NO hardcoded fallback credentials: the sole admin
 * account must be provisioned with operator-supplied secrets.
 *
 * @throws {Error} if `SEED_ADMIN_EMAIL` or `SEED_ADMIN_PASSWORD` is missing/empty.
 */
export function resolveSeedConfig(env: NodeJS.ProcessEnv): SeedConfig {
  const email = env.SEED_ADMIN_EMAIL?.trim();
  const password = env.SEED_ADMIN_PASSWORD;
  const name = env.SEED_ADMIN_NAME?.trim() || "Admin";

  if (!email) {
    throw new Error(
      "SEED_ADMIN_EMAIL is not set. Set SEED_ADMIN_EMAIL (and SEED_ADMIN_PASSWORD) in the environment before running the seed script.",
    );
  }

  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is not set. Set SEED_ADMIN_PASSWORD (and SEED_ADMIN_EMAIL) in the environment before running the seed script.",
    );
  }

  return { email, password, name };
}
