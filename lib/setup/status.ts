import { prisma } from "@/lib/db/prisma";

type SetupItem = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

export async function getSetupStatus(userId?: string) {
  const env = process.env;
  const items: SetupItem[] = [
    {
      key: "database",
      label: "Datenbank",
      ok: Boolean(env.DATABASE_URL) && !env.DATABASE_URL?.includes("USER:PASSWORD"),
      detail: env.DATABASE_URL?.includes("USER:PASSWORD")
        ? "DATABASE_URL ist noch ein Platzhalter."
        : "DATABASE_URL ist gesetzt."
    },
    {
      key: "auth",
      label: "Login",
      ok: Boolean(env.NEXTAUTH_SECRET && env.NEXTAUTH_URL),
      detail: "NEXTAUTH_URL und NEXTAUTH_SECRET werden geprüft."
    },
    {
      key: "encryption",
      label: "Verschlüsselung",
      ok: isValidEncryptionKey(env.ENCRYPTION_KEY),
      detail: "ENCRYPTION_KEY muss ein base64-kodierter 32-Byte-Key sein."
    },
    {
      key: "openai",
      label: "OpenAI",
      ok: Boolean(env.OPENAI_API_KEY),
      detail: env.OPENAI_API_KEY ? "KI-Anschreiben können live generiert werden." : "Ohne Key wird ein Fallback-Text genutzt."
    },
    {
      key: "telegram",
      label: "Telegram",
      ok: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      detail: "Bot Token und Chat ID werden für Benachrichtigungen benötigt."
    },
    {
      key: "scheduler",
      label: "Scheduler",
      ok: Boolean(env.SCHEDULER_SECRET),
      detail: "SCHEDULER_SECRET schützt den externen Scheduler-Endpoint."
    }
  ];

  if (userId) {
    const [profiles, accounts, settings] = await Promise.all([
      prisma.searchProfile.count({ where: { userId } }).catch(() => 0),
      prisma.portalAccount.count({ where: { userId } }).catch(() => 0),
      prisma.settings.findUnique({ where: { userId } }).catch(() => null)
    ]);

    items.push(
      {
        key: "profiles",
        label: "Suchprofile",
        ok: profiles > 0,
        detail: profiles > 0 ? `${profiles} Suchprofil(e) angelegt.` : "Noch kein Suchprofil angelegt."
      },
      {
        key: "portalAccounts",
        label: "Portal-Konten",
        ok: accounts > 0,
        detail: accounts > 0 ? `${accounts} Portal-Konto/Konten gespeichert.` : "Noch keine Portal-Zugangsdaten gespeichert."
      },
      {
        key: "settings",
        label: "Einstellungen",
        ok: Boolean(settings),
        detail: settings ? "Einstellungen sind angelegt." : "Einstellungen fehlen noch."
      }
    );
  }

  return {
    items,
    complete: items.every((item) => item.ok)
  };
}

function isValidEncryptionKey(value?: string) {
  if (!value) return false;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}
