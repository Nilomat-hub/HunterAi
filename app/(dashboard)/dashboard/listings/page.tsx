import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDetectedFeatures, formatRentDetails, getListingDetails } from "@/lib/listings/details";
import { applicationStatusLabels, contactMethodLabels, listingStatusLabels } from "@/lib/status-labels";
import { formatCurrency } from "@/lib/utils";

export default async function ListingsPage() {
  const userId = await requireUserId();
  const listings = await prisma.listing.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inserate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2">Titel</th>
                <th>Preis</th>
                <th>Größe</th>
                <th>Score</th>
                <th>Status</th>
                <th>Kontakt</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => {
                const application = listing.applications[0];
                const details = getListingDetails(listing.rawData);
                const features = formatDetectedFeatures(details);
                const rentDetails = formatRentDetails(details);
                return (
                  <tr key={listing.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link href={listing.url} target="_blank" className="inline-flex items-center gap-2 font-medium">
                        {listing.title}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <div className="text-muted-foreground">{listing.address ?? listing.portal}</div>
                      {features.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {features.map((feature) => (
                            <Badge key={feature} className="bg-muted text-muted-foreground">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {formatCurrency(listing.price)}
                      {rentDetails.length ? (
                        <div className="mt-1 max-w-40 text-xs text-muted-foreground">{rentDetails.join(" · ")}</div>
                      ) : null}
                    </td>
                    <td>{listing.size ? `${listing.size} m²` : "-"}</td>
                    <td>
                      <span className="font-semibold">{listing.score}</span>
                      <div className="text-muted-foreground">{listing.scoreLabel}</div>
                    </td>
                    <td>
                      <Badge>{listingStatusLabels[listing.status]}</Badge>
                      {application ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {applicationStatusLabels[application.status]}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {listing.contactMethod === "EXTERNAL" && listing.applicationUrl ? (
                        <Link href={listing.applicationUrl} target="_blank" className="text-primary">
                          {contactMethodLabels[listing.contactMethod]}
                        </Link>
                      ) : listing.contactMethod === "EMAIL" ? (
                        listing.contactEmail ?? "E-Mail"
                      ) : (
                        contactMethodLabels[listing.contactMethod]
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!listings.length ? <p className="py-6 text-sm text-muted-foreground">Noch keine Inserate.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
