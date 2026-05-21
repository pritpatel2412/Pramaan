import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

// Robustly load env file
const tryLoadEnv = (dir: string) => {
  const envPath = path.join(dir, ".env");
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
  current = path.join(current, "..");
}
try {
  tryLoadEnv(__dirname);
} catch {}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
