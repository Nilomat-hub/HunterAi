import type { InputHTMLAttributes } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createSearchProfile } from "@/lib/actions/search-profiles";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type SearchProfilesPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function SearchProfilesPage({ searchParams }: SearchProfilesPageProps) {
  const userId = await requireUserId();
  const params = await searchParams;
  const profiles = await prisma.searchProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Suchprofil anlegen</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSearchProfile} className="space-y-4">
            {params?.error === "validation" ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Bitte prüfe die Pflichtfelder und Zahlenwerte.
              </p>
            ) : null}
            <Field name="name" label="Name" />
            <Field name="city" label="Stadt" />
            <Field name="districts" label="Bezirke" placeholder="Kommagetrennt" />
            <div className="grid grid-cols-3 gap-3">
              <Field name="maxPrice" label="Max. Preis" type="number" />
              <Field name="minSize" label="Min. Größe" type="number" />
              <Field name="rooms" label="Zimmer" type="number" step="0.5" />
            </div>
            <Field name="keywords" label="Keywords" placeholder="Balkon, hell, ruhig" />
            <Field name="excludedWords" label="Ausschlusswörter" placeholder="Tauschwohnung" />
            <label className="flex items-center gap-2 text-sm">
              <input name="petsAllowed" type="checkbox" className="h-4 w-4" />
              Haustiere erforderlich
            </label>
            <SubmitButton pendingLabel="Speichert">
              <Plus className="h-4 w-4" />
              Speichern
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktive Suchprofile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {profiles.map((profile) => (
              <div key={profile.id} className="py-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{profile.name}</h3>
                  <span className="text-sm text-muted-foreground">{profile.active ? "Aktiv" : "Pausiert"}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile.city} · bis {profile.maxPrice} EUR · ab {profile.minSize} m² · {profile.rooms} Zimmer
                </p>
                <p className="mt-1 text-sm">{profile.districts.join(", ") || "Alle Bezirke"}</p>
              </div>
            ))}
            {!profiles.length ? <p className="text-sm text-muted-foreground">Noch keine Suchprofile.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field(props: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, name, ...inputProps } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required={!["districts", "keywords", "excludedWords"].includes(name)} {...inputProps} />
    </div>
  );
}
