import { Building2, Send, TrendingUp, MailCheck } from "lucide-react";
import { ManualListingForm } from "@/app/(dashboard)/dashboard/manual-listing-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [listings, sent, replies, applications, recent] = await Promise.all([
    prisma.listing.count({ where: { userId } }),
    prisma.application.count({ where: { userId, status: "SENT" } }),
    prisma.message.count({ where: { userId, direction: "INBOUND" } }),
    prisma.application.count({ where: { userId } }),
    prisma.listing.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);
  const successRate = applications ? Math.round((replies / applications) * 100) : 0;

  const stats = [
    { label: "Wohnungen gefunden", value: listings, icon: Building2 },
    { label: "Bewerbungen gesendet", value: sent, icon: Send },
    { label: "Antworten erhalten", value: replies, icon: MailCheck },
    { label: "Erfolgsquote", value: `${successRate}%`, icon: TrendingUp }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                </div>
                <Icon className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manuelles Inserat hinzufügen</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualListingForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Neueste Inserate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {recent.map((listing) => (
              <div key={listing.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{listing.title}</p>
                  <p className="text-sm text-muted-foreground">{listing.address ?? listing.portal}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{listing.score}</p>
                  <p className="text-sm text-muted-foreground">{listing.scoreLabel}</p>
                </div>
              </div>
            ))}
            {!recent.length ? <p className="text-sm text-muted-foreground">Noch keine Inserate gespeichert.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
