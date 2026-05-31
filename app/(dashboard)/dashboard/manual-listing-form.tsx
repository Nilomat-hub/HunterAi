"use client";

import { useActionState } from "react";
import { Link as LinkIcon, Plus } from "lucide-react";
import { addManualListing } from "@/lib/actions/listings";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const initialState = { ok: false, message: "" };

export function ManualListingForm() {
  const [state, formAction, pending] = useActionState(addManualListing, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="url">Inserat-URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input id="url" name="url" className="pl-9" placeholder="https://..." required />
          </div>
          <Button disabled={pending}>
            <Plus className="h-4 w-4" />
            {pending ? "Lädt" : "Hinzufügen"}
          </Button>
        </div>
      </div>
      {state.message ? (
        <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
    </form>
  );
}
