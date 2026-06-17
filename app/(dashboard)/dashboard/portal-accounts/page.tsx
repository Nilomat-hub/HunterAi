import { Portal } from "@prisma/client";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { savePortalAccount } from "@/lib/actions/portal-accounts";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const portalLabels: Record<Portal, string> = {
  IMMOSCOUT24: "ImmoScout24",
  IMMOWELT: "Immowelt",
  IMMONET: "Immonet",
  MEINESTADT: "meineStadt",
  IMMOBILIE1: "immobilie1",
  IMMOMIO: "Immomio",
  KLEINANZEIGEN: "Kleinanzeigen"
};

type PortalAccountsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function PortalAccountsPage({ searchParams }: PortalAccountsPageProps) {
  const userId = await requireUserId();
  const params = await searchParams;
  const accounts = await prisma.portalAccount.findMany({ where: { userId } });
  const connected = new Set(accounts.map((account) => account.portal));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {params?.error === "validation" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive md:col-span-2">
          Bitte Portal, Benutzername und Passwort prüfen.
        </div>
      ) : null}
      {Object.values(Portal).map((portal) => (
        <Card key={portal}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {portalLabels[portal]}
              <span className="text-sm font-normal text-muted-foreground">
                {connected.has(portal) ? "Gespeichert" : "Nicht verbunden"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={savePortalAccount} className="space-y-4">
              <input type="hidden" name="portal" value={portal} />
              <div className="space-y-2">
                <Label htmlFor={`${portal}-username`}>Benutzername</Label>
                <Input id={`${portal}-username`} name="username" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${portal}-password`}>Passwort</Label>
                <Input id={`${portal}-password`} name="password" type="password" autoComplete="current-password" required />
              </div>
              <SubmitButton pendingLabel="Speichert">
                <KeyRound className="h-4 w-4" />
                Zugang speichern
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
