import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const required = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "SCHEDULER_SECRET",
  "ENCRYPTION_KEY",
  "INITIAL_USER_EMAIL",
  "INITIAL_USER_PASSWORD"
];

async function main() {
  let hasError = false;

  for (const key of required) {
    const value = process.env[key];
    const ok = Boolean(value) && !String(value).includes("USER:PASSWORD") && !String(value).includes("change-me");
    console.log(`${ok ? "OK" : "FEHLT"} ${key}`);
    if (!ok) hasError = true;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("OK Datenbankverbindung");
  } catch (error) {
    hasError = true;
    console.log("FEHLT Datenbankverbindung");
    console.log(error instanceof Error ? error.message : error);
  }

  try {
    const users = await prisma.user.count();
    console.log(`${users > 0 ? "OK" : "FEHLT"} Seed-User (${users})`);
    if (users === 0) hasError = true;
  } catch {
    hasError = true;
    console.log("FEHLT Tabellen/Migrationen");
  }

  try {
    const [profiles, listings, applications] = await Promise.all([
      prisma.searchProfile.count(),
      prisma.listing.count(),
      prisma.application.count()
    ]);
    console.log(`${profiles > 0 ? "OK" : "HINWEIS"} Suchprofile (${profiles})`);
    console.log(`${listings > 0 ? "OK" : "HINWEIS"} Inserate (${listings})`);
    console.log(`${applications > 0 ? "OK" : "HINWEIS"} Bewerbungen (${applications})`);
  } catch {
    console.log("HINWEIS Demo-Daten konnten noch nicht geprüft werden.");
  }

  if (hasError) {
    process.exitCode = 1;
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
