import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it's not supported in all environments
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
