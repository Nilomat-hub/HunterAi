import { CheckCircle2, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import { getSetupStatus } from "@/lib/setup/status";

export default async function SetupPage() {
  const userId = await requireUserId();
  const status = await getSetupStatus(userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Setup-Status
          <Badge>{status.complete ? "Bereit" : "Offen"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {status.items.map((item) => {
            const Icon = item.ok ? CheckCircle2 : CircleAlert;
            return (
              <div key={item.key} className="flex gap-3 py-4">
                <Icon className={item.ok ? "mt-0.5 h-5 w-5 text-primary" : "mt-0.5 h-5 w-5 text-accent"} />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
