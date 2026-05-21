import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { join } from "path";
import fs from "fs";

// Robustly load env file
const tryLoadEnv = (dir: string) => {
  const envPath = join(dir, ".env");
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      return true;
    } catch (e) {
      // Ignore
    }
  }
  return false;
};

let current = process.cwd();
for (let i = 0; i < 4; i++) {
  if (tryLoadEnv(current)) break;
  current = join(current, "..");
}
try {
  tryLoadEnv(__dirname);
} catch {}

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
