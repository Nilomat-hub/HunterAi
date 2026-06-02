"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
  salutation: z.string().optional(),
  age: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  occupation: z.string().optional(),
  dualStudyProgram: z.string().optional(),
  employer: z.string().optional(),
  netIncome: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  monthlyAvailableBudget: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  guarantorAvailable: z.boolean(),
  currentHousingSituation: z.string().optional(),
  moveReason: z.string().optional(),
  locationBenefit: z.string().optional(),
  householdSize: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  pets: z.string().optional(),
  moveInDate: z.string().optional(),
  personalBio: z.string().optional()
});

const settingsSchema = z.object({
  schedulerEnabled: z.boolean(),
  autoApplyEnabled: z.boolean(),
  autoApplyMinScore: z.coerce.number().int().min(0).max(100),
  maxPerHour: z.coerce.number().int().min(1).max(50),
  maxPerDay: z.coerce.number().int().min(1).max(200)
});

export async function saveProfile(formData: FormData) {
  const userId = await requireUserId();
  const parsed = profileSchema.safeParse({
    ...Object.fromEntries(formData),
    guarantorAvailable: formData.get("guarantorAvailable") === "on"
  });

  if (!parsed.success) {
    redirect("/dashboard/settings?error=profile");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...parsed.data,
      moveInDate: parsed.data.moveInDate ? new Date(parsed.data.moveInDate) : null
    }
  });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=profile");
}

export async function saveSettings(formData: FormData) {
  const userId = await requireUserId();
  const parsed = settingsSchema.safeParse({
    schedulerEnabled: formData.get("schedulerEnabled") === "on",
    autoApplyEnabled: formData.get("autoApplyEnabled") === "on",
    autoApplyMinScore: formData.get("autoApplyMinScore"),
    maxPerHour: formData.get("maxPerHour"),
    maxPerDay: formData.get("maxPerDay")
  });

  if (!parsed.success) {
    redirect("/dashboard/settings?error=settings");
  }

  await prisma.settings.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data
  });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=settings");
}
