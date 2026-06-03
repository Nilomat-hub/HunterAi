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
  const busy = application.status === "PREPARING";
  const final = application.status === "SENT" || application.status === "IGNORED";
  const editable = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "READY_TO_SUBMIT", "FAILED"].includes(application.status);
  const canApprove = editable && !busy && !final;
  const canPrepare = application.status === "APPROVED" && Boolean(application.listing.applicationUrl);
  const canMarkSent = ["APPROVED", "READY_TO_SUBMIT"].includes(application.status);
  const canIgnore = !busy && !final;
  const sendsOnApprove = application.listing.portal === "IMMOBILIE1" && !application.listing.applicationUrl;

  return (
    <Card>
      <CardHeader className="flex gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{application.listing.title}</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{formatCurrency(application.listing.price)}</span>
            <span>{application.listing.size ? `${application.listing.size} m²` : "Größe offen"}</span>
            <span>{application.listing.rooms ? `${application.listing.rooms} Zimmer` : "Zimmer offen"}</span>
            <span className="font-medium text-foreground">
              Score {application.listing.score} ({application.listing.scoreLabel})
            </span>
            <a
              className="inline-flex items-center gap-1 text-primary"
              href={application.listing.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Inserat
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {application.listing.applicationUrl ? (
              <a
                className="inline-flex items-center gap-1 text-primary"
                href={application.listing.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
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
        <form action={saveApplicationMessage} className="space-y-4">
          <input type="hidden" name="applicationId" value={application.id} />
          <Textarea name="message" defaultValue={message} disabled={!editable} className="min-h-56 leading-6" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!editable}>
              <Save className="h-4 w-4" />
              Speichern
            </Button>

            <Button formAction={approveApplication} disabled={!canApprove}>
              <Check className="h-4 w-4" />
              {sendsOnApprove ? "Manuell freigeben & abschicken" : "Freigeben"}
            </Button>

            {application.listing.applicationUrl ? (
              <Button formAction={prepareExternalApplication} variant="secondary" disabled={!canPrepare}>
                <ExternalLink className="h-4 w-4" />
                Bewerbung vorbereiten
              </Button>
            ) : null}

            <Button formAction={markApplicationSent} variant="secondary" disabled={!canMarkSent}>
              <Send className="h-4 w-4" />
              Als versendet markieren
            </Button>

            <Button formAction={ignoreApplication} variant="ghost" disabled={!canIgnore}>
              <X className="h-4 w-4" />
              Ignorieren
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
      </CardContent>
    </Card>
  );
}
