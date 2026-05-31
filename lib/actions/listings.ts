"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { processManualListing } from "@/lib/listings/pipeline";
import { prisma } from "@/lib/db/prisma";

const manualListingSchema = z.object({
  url: z.string().url()
});

export async function addManualListing(_: unknown, formData: FormData) {
  const userId = await requireUserId();
  const parsed = manualListingSchema.safeParse({
    url: formData.get("url")
  });

  if (!parsed.success) {
    return { ok: false, message: "Bitte eine gültige URL eingeben." };
  }

  try {
    const listing = await processManualListing(userId, parsed.data.url);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/listings");
    return { ok: true, message: `Inserat gespeichert: ${listing.title}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Inserat konnte nicht verarbeitet werden."
    };
  }
}

export async function ignoreListing(listingId: string) {
  const userId = await requireUserId();
  await prisma.listing.updateMany({
    where: { id: listingId, userId },
    data: { status: "IGNORED" }
  });
  revalidatePath("/dashboard/listings");
}
