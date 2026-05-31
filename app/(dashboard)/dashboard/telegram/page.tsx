import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const typeLabels = {
  LISTING_FOUND: "Inserat gefunden",
  APPLICATION_SENT: "Bewerbung versendet",
  REPLY_RECEIVED: "Antwort empfangen",
  ERROR: "Fehler",
  ACTION: "Aktion"
};

export default async function TelegramPage() {
  const userId = await requireUserId();
  const logs = await prisma.telegramLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 40
  });

  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={configured ? "bg-primary text-primary-foreground" : "bg-secondary"}>
              {configured ? "Konfiguriert" : "Noch nicht konfiguriert"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Benachrichtigungen werden hier mitprotokolliert, auch wenn noch kein Bot verbunden ist.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Ereignisse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2">Zeit</th>
                  <th>Typ</th>
                  <th>Nachricht</th>
                  <th>Telegram-ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-3 text-muted-foreground">{formatDate(log.createdAt)}</td>
                    <td>
                      <Badge>{typeLabels[log.type]}</Badge>
                    </td>
                    <td className="max-w-xl truncate">{log.message}</td>
                    <td className="text-muted-foreground">{log.telegramId ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!logs.length ? (
              <p className="py-6 text-sm text-muted-foreground">Noch keine Telegram-Ereignisse.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(value);
}
