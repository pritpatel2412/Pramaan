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

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
