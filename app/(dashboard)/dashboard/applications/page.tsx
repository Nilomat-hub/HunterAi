import { ApplicationCard } from "@/app/(dashboard)/dashboard/applications/application-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ApplicationsPage() {
  const userId = await requireUserId();
  const applications = await prisma.application.findMany({
    where: { userId },
    include: { listing: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <ApplicationCard key={application.id} application={application} />
      ))}
      {!applications.length ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Noch keine Bewerbungen vorbereitet.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
