import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  console.log(".env already exists. No changes made.");
  process.exit(0);
}

const schedulerSecret = crypto.randomBytes(32).toString("base64url");
const nextAuthSecret = crypto.randomBytes(32).toString("base64url");
const encryptionKey = crypto.randomBytes(32).toString("base64");

const content = `DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${nextAuthSecret}"
OPENAI_API_KEY=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
SCHEDULER_SECRET="${schedulerSecret}"
ENCRYPTION_KEY="${encryptionKey}"
INITIAL_USER_EMAIL="you@example.com"
INITIAL_USER_PASSWORD="change-me-before-deploy"
`;

fs.writeFileSync(envPath, content, { encoding: "utf8", flag: "wx" });
console.log(".env created with generated local secrets.");
