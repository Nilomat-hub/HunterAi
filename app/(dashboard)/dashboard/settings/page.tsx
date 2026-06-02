import type { InputHTMLAttributes } from "react";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveProfile, saveSettings } from "@/lib/actions/settings";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type SettingsPageProps = {
  searchParams?: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const userId = await requireUserId();
  const params = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { settings: true }
  });
  const settings = user.settings;
  const savedMessage =
    params?.saved === "profile"
      ? "Profil gespeichert."
      : params?.saved === "settings"
        ? "Einstellungen gespeichert."
        : undefined;

  return (
    <div className="space-y-4">
      {savedMessage ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {savedMessage}
        </div>
      ) : null}
      {params?.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          Bitte prüfe die eingegebenen Werte.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>KI-Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field name="firstName" label="Vorname" defaultValue={user.firstName ?? ""} />
              <Field name="lastName" label="Nachname" defaultValue={user.lastName ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="contactEmail" label="Kontakt-E-Mail" type="email" defaultValue={user.contactEmail ?? ""} />
              <Field name="phone" label="Telefon" defaultValue={user.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salutation">Anrede</Label>
              <select
                id="salutation"
                name="salutation"
                defaultValue={user.salutation ?? "Herr"}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
                <option value="Divers">Divers</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="age" label="Alter" type="number" defaultValue={user.age ?? ""} />
              <Field
                name="monthlyAvailableBudget"
                label="Monatlich verfügbares Budget"
                type="number"
                defaultValue={user.monthlyAvailableBudget ?? user.netIncome ?? ""}
              />
            </div>
            <Field name="occupation" label="Beruf" defaultValue={user.occupation ?? ""} />
            <Field name="dualStudyProgram" label="Studium / Ausbildung" defaultValue={user.dualStudyProgram ?? ""} />
            <Field name="employer" label="Arbeitgeber" defaultValue={user.employer ?? ""} />
            <Field name="netIncome" label="Nettoeinkommen (optional)" type="number" defaultValue={user.netIncome ?? ""} />
            <label className="flex items-center gap-2 text-sm">
              <input name="guarantorAvailable" type="checkbox" defaultChecked={user.guarantorAvailable} />
              Bürgschaft durch Eltern möglich
            </label>
            <Field name="householdSize" label="Haushaltsgröße" type="number" defaultValue={user.householdSize ?? ""} />
            <Field name="pets" label="Haustiere" defaultValue={user.pets ?? ""} />
            <Field
              name="moveInDate"
              label="Einzugsdatum"
              type="date"
              defaultValue={user.moveInDate?.toISOString().slice(0, 10) ?? ""}
            />
            <div className="space-y-2">
              <Label htmlFor="currentHousingSituation">Aktuelle Wohn- und Pendelsituation</Label>
              <Textarea
                id="currentHousingSituation"
                name="currentHousingSituation"
                defaultValue={user.currentHousingSituation ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moveReason">Umzugsgrund</Label>
              <Textarea id="moveReason" name="moveReason" defaultValue={user.moveReason ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationBenefit">Lagevorteil im Anschreiben</Label>
              <Textarea id="locationBenefit" name="locationBenefit" defaultValue={user.locationBenefit ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="personalBio">Persönliche Beschreibung</Label>
              <Textarea id="personalBio" name="personalBio" defaultValue={user.personalBio ?? ""} />
            </div>
            <SubmitButton pendingLabel="Speichert">
              <Save className="h-4 w-4" />
              Profil speichern
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatisierung</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveSettings} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input name="schedulerEnabled" type="checkbox" defaultChecked={settings?.schedulerEnabled ?? true} />
              Scheduler aktiv
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="autoApplyEnabled" type="checkbox" defaultChecked={settings?.autoApplyEnabled ?? false} />
              Auto-Modus aktiv
            </label>
            <Field
              name="autoApplyMinScore"
              label="Auto-Modus ab Score"
              type="number"
              defaultValue={settings?.autoApplyMinScore ?? 90}
            />
            <Field
              name="maxPerHour"
              label="Max. Bewerbungen pro Stunde"
              type="number"
              defaultValue={settings?.maxPerHour ?? 10}
            />
            <Field
              name="maxPerDay"
              label="Max. Bewerbungen pro Tag"
              type="number"
              defaultValue={settings?.maxPerDay ?? 50}
            />
            <SubmitButton pendingLabel="Speichert">
              <Save className="h-4 w-4" />
              Einstellungen speichern
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function Field(props: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, name, ...inputProps } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...inputProps} />
    </div>
  );
}
