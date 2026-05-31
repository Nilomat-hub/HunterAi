"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Portal } from "@prisma/client";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { prepareImmomioApplication } from "@/lib/external-applications/immomio";
import { canSendApplication } from "@/lib/rate-limit/applications";

const messageSchema = z.object({
  applicationId: z.string().min(1),
  message: z.string().min(20, "Das Anschreiben ist zu kurz.")
});

async function getOwnedApplication(userId: string, applicationId: string) {
  return prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: { listing: true }
  });
}

export async function saveApplicationMessage(formData: FormData) {
  const userId = await requireUserId();
  const parsed = messageSchema.parse({
    applicationId: formData.get("applicationId"),
    message: formData.get("message")
  });

  await prisma.application.updateMany({
    where: { id: parsed.applicationId, userId },
    data: {
      editedMessage: parsed.message,
      status: "PENDING_APPROVAL"
    }
  });

  revalidatePath("/dashboard/applications");
}

export async function approveApplication(formData: FormData) {
  const userId = await requireUserId();
  const applicationId = String(formData.get("applicationId") ?? "");
  const application = await getOwnedApplication(userId, applicationId);

  if (!application) return;

  await prisma.$transaction([
    prisma.application.update({
      where: { id: application.id },
      data: { status: "APPROVED" }
    }),
    prisma.telegramLog.create({
      data: {
        userId,
        type: "ACTION",
        message: "Bewerbung im Dashboard freigegeben.",
        payload: { applicationId: application.id, listingId: application.listingId }
      }
    })
  ]);

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/listings");
}

export async function ignoreApplication(formData: FormData) {
  const userId = await requireUserId();
  const applicationId = String(formData.get("applicationId") ?? "");
  const application = await getOwnedApplication(userId, applicationId);

  if (!application) return;

  await prisma.$transaction([
    prisma.application.update({
      where: { id: application.id },
      data: { status: "IGNORED" }
    }),
    prisma.listing.update({
      where: { id: application.listingId },
      data: { status: "IGNORED" }
    }),
    prisma.telegramLog.create({
      data: {
        userId,
        type: "ACTION",
        message: "Bewerbung ignoriert.",
        payload: { applicationId: application.id, listingId: application.listingId }
      }
    })
  ]);

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/listings");
}

export async function markApplicationSent(formData: FormData) {
  const userId = await requireUserId();
  const applicationId = String(formData.get("applicationId") ?? "");
  const application = await getOwnedApplication(userId, applicationId);

  if (!application) return;

  const limit = await canSendApplication(userId);
  if (!limit.allowed) {
    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "FAILED",
        errorMessage: `Rate Limit erreicht: ${limit.hourCount}/${limit.maxPerHour} pro Stunde, ${limit.dayCount}/${limit.maxPerDay} pro Tag.`
      }
    });
    revalidatePath("/dashboard/applications");
    return;
  }

  await prisma.$transaction([
    prisma.application.update({
      where: { id: application.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage: null
      }
    }),
    prisma.listing.update({
      where: { id: application.listingId },
      data: { status: "APPLIED" }
    }),
    prisma.telegramLog.create({
      data: {
        userId,
        type: "APPLICATION_SENT",
        message: "Bewerbung als versendet markiert.",
        payload: { applicationId: application.id, listingId: application.listingId }
      }
    })
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/listings");
}

export async function prepareExternalApplication(formData: FormData) {
  const userId = await requireUserId();
  const applicationId = String(formData.get("applicationId") ?? "");
  const application = await getOwnedApplication(userId, applicationId);

  if (!application || !application.listing.applicationUrl) return;

  await prisma.application.update({
    where: { id: application.id },
    data: {
      status: "PREPARING",
      externalStatus: "Vorbereitung läuft",
      errorMessage: null
    }
  });

  const account = await prisma.portalAccount.findUnique({
    where: {
      userId_portal: {
        userId,
        portal: Portal.IMMOMIO
      }
    }
  });

  const result = await prepareImmomioApplication({ application, account });
  const nextStatus =
    result.status === "READY_FOR_MANUAL_REVIEW"
      ? "READY_TO_SUBMIT"
      : result.status === "FAILED"
        ? "FAILED"
        : "APPROVED";

  await prisma.application.update({
    where: { id: application.id },
    data: {
      status: nextStatus,
      externalStatus: result.note,
      externalPayload: {
        url: result.url,
        fields: result.fields,
        status: result.status
      },
      lastPreparedAt: new Date(),
      errorMessage: result.status === "FAILED" ? result.note : null
    }
  });

  revalidatePath("/dashboard/applications");
}
