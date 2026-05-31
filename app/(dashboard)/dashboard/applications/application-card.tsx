import type { Application, Listing } from "@prisma/client";
import { Check, ExternalLink, Save, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import {
  approveApplication,
  ignoreApplication,
  markApplicationSent,
  prepareExternalApplication,
  saveApplicationMessage
} from "@/lib/actions/applications";
import { applicationStatusLabels } from "@/lib/status-labels";
import { formatCurrency } from "@/lib/utils";

type ApplicationWithListing = Application & {
  listing: Listing;
};

export function ApplicationCard({ application }: { application: ApplicationWithListing }) {
  const message = application.editedMessage ?? application.message;
  const disabled = application.status === "SENT" || application.status === "IGNORED";

  return (
    <Card>
      <CardHeader className="flex gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{application.listing.title}</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{formatCurrency(application.listing.price)}</span>
            <span>{application.listing.size ? `${application.listing.size} m²` : "Größe offen"}</span>
            <span>{application.listing.rooms ? `${application.listing.rooms} Zimmer` : "Zimmer offen"}</span>
            <a className="inline-flex items-center gap-1 text-primary" href={application.listing.url} target="_blank">
              Inserat
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {application.listing.applicationUrl ? (
              <a
                className="inline-flex items-center gap-1 text-primary"
                href={application.listing.applicationUrl}
                target="_blank"
              >
                Bewerbungslink
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
        <Badge>{applicationStatusLabels[application.status]}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={saveApplicationMessage} className="space-y-3">
          <input type="hidden" name="applicationId" value={application.id} />
          <Textarea name="message" defaultValue={message} disabled={disabled} className="min-h-56 leading-6" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={disabled}>
              <Save className="h-4 w-4" />
              Speichern
            </Button>
          </div>
        </form>

        {application.errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {application.errorMessage}
          </p>
        ) : null}

        {application.externalStatus ? (
          <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            {application.externalStatus}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <form action={approveApplication}>
            <input type="hidden" name="applicationId" value={application.id} />
            <Button disabled={disabled || application.status === "APPROVED"}>
              <Check className="h-4 w-4" />
              Freigeben
            </Button>
          </form>

          {application.listing.applicationUrl ? (
            <form action={prepareExternalApplication}>
              <input type="hidden" name="applicationId" value={application.id} />
              <Button variant="secondary" disabled={application.status !== "APPROVED"}>
                <ExternalLink className="h-4 w-4" />
                Bewerbung vorbereiten
              </Button>
            </form>
          ) : null}

          <form action={markApplicationSent}>
            <input type="hidden" name="applicationId" value={application.id} />
            <Button variant="secondary" disabled={!["APPROVED", "READY_TO_SUBMIT"].includes(application.status)}>
              <Send className="h-4 w-4" />
              Als versendet markieren
            </Button>
          </form>

          <form action={ignoreApplication}>
            <input type="hidden" name="applicationId" value={application.id} />
            <Button variant="ghost" disabled={disabled}>
              <X className="h-4 w-4" />
              Ignorieren
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
