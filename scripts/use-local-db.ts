import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
const localDatabaseUrl = "postgresql://apartment_hunter:apartment_hunter_dev@localhost:5432/apartment_hunter";

if (!fs.existsSync(envPath)) {
  throw new Error(".env fehlt. Bitte zuerst npm run setup:env ausführen.");
}

const env = fs.readFileSync(envPath, "utf8");
const next = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${localDatabaseUrl}"`);

fs.writeFileSync(envPath, next, "utf8");
console.log("DATABASE_URL auf lokale Docker-Postgres-Datenbank gesetzt.");
