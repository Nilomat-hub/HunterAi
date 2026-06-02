"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  districts: z.string().optional(),
  maxPrice: z.coerce.number().int().positive(),
  minSize: z.coerce.number().int().positive(),
  rooms: z.coerce.number().positive(),
  petsAllowed: z.boolean(),
  keywords: z.string().optional(),
  excludedWords: z.string().optional()
});

export async function createSearchProfile(formData: FormData) {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    ...Object.fromEntries(formData),
    petsAllowed: formData.get("petsAllowed") === "on"
  });

  if (!parsed.success) {
    redirect("/dashboard/search-profiles?error=validation");
  }

  await prisma.searchProfile.create({
    data: {
      userId,
      name: parsed.data.name,
      city: parsed.data.city,
      districts: splitList(parsed.data.districts),
      maxPrice: parsed.data.maxPrice,
      minSize: parsed.data.minSize,
      rooms: parsed.data.rooms,
      petsAllowed: parsed.data.petsAllowed,
      keywords: splitList(parsed.data.keywords),
      excludedWords: splitList(parsed.data.excludedWords)
    }
  });

  revalidatePath("/dashboard/search-profiles");
}

function splitList(value?: string) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
