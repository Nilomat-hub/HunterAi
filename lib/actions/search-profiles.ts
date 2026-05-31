"use server";

import { revalidatePath } from "next/cache";
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
  const parsed = schema.parse({
    ...Object.fromEntries(formData),
    petsAllowed: formData.get("petsAllowed") === "on"
  });

  await prisma.searchProfile.create({
    data: {
      userId,
      name: parsed.name,
      city: parsed.city,
      districts: splitList(parsed.districts),
      maxPrice: parsed.maxPrice,
      minSize: parsed.minSize,
      rooms: parsed.rooms,
      petsAllowed: parsed.petsAllowed,
      keywords: splitList(parsed.keywords),
      excludedWords: splitList(parsed.excludedWords)
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
