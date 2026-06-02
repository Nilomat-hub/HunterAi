"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Portal, type ApplicationStatus } from "@prisma/client";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { submitImmobilie1ContactApplication } from "@/lib/external-applications/immobilie1";
import { prepareImmomioApplication } from "@/lib/external-applications/immomio";
import { canSendApplication } from "@/lib/rate-limit/applications";

const messageSchema = z.object({
  applicationId: z.string().min(1),
  message: z.string().min(20, "Das Anschreiben ist zu kurz.")
});

const editableStatuses = new Set<ApplicationStatus>(["DRAFT", "PENDING_APPROVAL", "APPROVED", "READY_TO_SUBMIT", "FAILED"]);
const approvableStatuses = new Set<ApplicationStatus>(["DRAFT", "PENDING_APPROVAL", "FAILED"]);
const busyOrFinalStatuses = new Set<ApplicationStatus>(["PREPARING", "SENT", "IGNORED"]);
const sendableStatuses = new Set<ApplicationStatus>(["APPROVED", "READY_TO_SUBMIT"]);

async function getOwnedApplication(userId: string, applicationId: string) {
  return prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: { listing: true }
  });
}

function parseMessageUpdate(formData: FormData) {
  if (!formData.has("message")) return null;

  const parsed = messageSchema.safeParse({
    applicationId: formData.get("applicationId"),
    message: formData.get("message")
  });

  return parsed.success ? parsed.data : null;
}

async function applySubmittedMessage(userId: string, applicationId: string, formData: FormData) {
  const parsed = parseMessageUpdate(formData);
  if (!parsed || parsed.applicationId !== applicationId) return;

  await prisma.application.updateMany({
    where: {
      id: applicationId,
      userId,
      status: { in: Array.from(editableStatuses) }
    },
    data: {
      editedMessage: parsed.message,
      errorMessage: null
    }
  });
}

export async function saveApplicationMessage(formData: FormData) {
  const userId = await requireUserId();
  const parsed = messageSchema.safeParse({
    applicationId: formData.get("applicationId"),
    message: formData.get("message")
  });

  if (!parsed.success) {
    revalidatePath("/dashboard/applications");
    return;
  }

  const application = await prisma.application.findFirst({
    where: { id: parsed.data.applicationId, userId },
    select: { id: true, status: true }
  });

  if (!application || !editableStatuses.has(application.status)) {
    revalidatePath("/dashboard/applications");
    return;
  }

  await prisma.application.update({
    where: { id: application.id },
    data: {
      editedMessage: parsed.data.message,
      status: ["DRAFT", "FAILED"].includes(application.status) ? "PENDING_APPROVAL" : application.status
    }
  });

  revalidatePath("/dashboard/applications");
}

export async function approveApplication(formData: FormData) {
  const userId = await requireUserId();
  const applicationId = String(formData.get("applicationId") ?? "");
  await applySubmittedMessage(userId, applicationId, formData);
  const application = await getOwnedApplication(userId, applicationId);

  if (!application) return;
  if (!approvableStatuses.has(application.status)) return;

  if (application.listing.portal === Portal.IMMOBILIE1 && !application.listing.applicationUrl) {
    await submitImmobilie1Application(userId, application);
  } else {
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
  }

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/listings");
}

async function submitImmobilie1Application(
  userId: string,
  application: NonNullable<Awaited<ReturnType<typeof getOwnedApplication>>>
) {
  if (!approvableStatuses.has(application.status)) return;

  const limit = await canSendApplication(userId);
  if (!limit.allowed) {
    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "FAILED",
        errorMessage: `Rate Limit erreicht: ${limit.hourCount}/${limit.maxPerHour} pro Stunde, ${limit.dayCount}/${limit.maxPerDay} pro Tag.`
      }
    });
    return;
  }

  await prisma.application.update({
    where: { id: application.id },
    data: {
      status: "PREPARING",
      externalStatus: "Freigegeben. Immobilie1-Bewerbung wird abgeschickt.",
      errorMessage: null
    }
  });

  if (!application.listing.applicationUrl) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const result = await submitImmobilie1ContactApplication({ application, user });

    if (result.status === "SUBMITTED") {
      await prisma.$transaction([
        prisma.application.update({
          where: { id: application.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            externalStatus: result.note,
            externalPayload: {
              url: result.url,
              status: result.status
            },
            lastPreparedAt: new Date(),
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
            message: "Immobilie1-Kontaktanfrage wurde automatisch abgeschickt.",
            payload: { applicationId: application.id, listingId: application.listingId, url: result.url }
          }
        })
      ]);
      return;
    }

    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "FAILED",
        externalStatus: result.note,
        externalPayload: {
          url: result.url,
          status: result.status
        },
        lastPreparedAt: new Date(),
        errorMessage: result.note
      }
    });
    return;
  }

  const account = await prisma.portalAccount.findFirst({
    where: {
      userId,
      portal: { in: [Portal.IMMOMIO, Portal.IMMOBILIE1] }
    },
    orderBy: [{ portal: "asc" }]
  });

  const result = await prepareImmomioApplication({ application, account, submit: true });

  if (result.status === "SUBMITTED") {
    await prisma.$transaction([
      prisma.application.update({
        where: { id: application.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          externalStatus: result.note,
          externalPayload: {
            url: result.url,
            fields: result.fields,
            status: result.status
          },
          lastPreparedAt: new Date(),
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
          message: "Immobilie1-Bewerbung wurde automatisch abgeschickt.",
          payload: { applicationId: application.id, listingId: application.listingId, url: result.url }
        }
      })
    ]);
    return;
  }

  const nextStatus = result.status === "FAILED" ? "FAILED" : "APPROVED";
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
}

export async function ignoreApplication(formData: FormData) {
  const userId = await requireUserId();
  const applicationId = String(formData.get("applicationId") ?? "");
  const application = await getOwnedApplication(userId, applicationId);

  if (!application) return;
  if (busyOrFinalStatuses.has(application.status)) return;

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
  if (!sendableStatuses.has(application.status)) return;

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
  await applySubmittedMessage(userId, applicationId, formData);
  const application = await getOwnedApplication(userId, applicationId);

  if (!application || !application.listing.applicationUrl) return;
  if (application.status !== "APPROVED") return;

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
