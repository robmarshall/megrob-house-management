import { db } from "./index.js";
import { user, account } from "./auth-schema.js";
import { eq } from "drizzle-orm";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { logger } from "../lib/logger.js";

// Match Better Auth's exact implementation from their source code
const config = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
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

async function seed() {
  logger.info("Seeding database...");

  const email = "hello@robertmarshall.dev";
  const password = "Password1*";
  const name = "Robert Marshall";

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, email));

    if (existingUser.length > 0) {
      logger.info("User already exists. Deleting and recreating...");
      // Delete existing account and user
      await db.delete(account).where(eq(account.userId, existingUser[0].id));
      await db.delete(user).where(eq(user.id, existingUser[0].id));
    }

    // Generate user ID
    const userId = crypto.randomUUID();

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert user
    await db.insert(user).values({
      id: userId,
      email,
      name,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert account with password (Better Auth stores password in account table)
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId: userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info({ email, name, userId }, "User created successfully");
  } catch (error) {
    logger.error({ err: error }, "Error creating user");
    throw error;
  }

  logger.info("Seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  logger.error({ err: error }, "Seeding failed");
  process.exit(1);
});
