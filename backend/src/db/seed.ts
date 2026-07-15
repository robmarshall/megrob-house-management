import { db } from "./index.js";
import { user, account } from "./auth-schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { hashPassword, resolveSeedConfig } from "./seedHelpers.js";

async function seed() {
  logger.info("Seeding database...");

  // Credentials are sourced from the environment (no hardcoded secrets).
  const { email, password, name } = resolveSeedConfig(process.env);

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, email));

    if (existingUser.length > 0) {
      // Idempotent + non-destructive: never delete/recreate an existing admin
      // (that would reset their password and cascade-delete their sessions).
      logger.info({ email }, "Admin user already exists. Skipping seed.");
      logger.info("Seeding complete!");
      process.exit(0);
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
