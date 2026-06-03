import type { ContactMethod, Prisma, SearchProfile } from "@prisma/client";
import { generateApplicationMessage } from "@/lib/ai/applications";
import { prisma } from "@/lib/db/prisma";
import { getAdapterForUrl, portalAdapters } from "@/lib/portals/adapters";
import type { ExtractedListing as PortalListing } from "@/lib/portals/types";
import { scoreListing } from "@/lib/scoring/score";
import { listingButtons, sendTelegramMessage } from "@/lib/telegram/client";
import { formatCurrency, normalizeUrl } from "@/lib/utils";
import { canSendApplication } from "@/lib/rate-limit/applications";

const emailHints = ["besser unter", "bitte per mail", "kontakt per e-mail", "kontakt per email"];

type PersistListingAction = "created" | "updated" | "skipped";

type PersistListingResult = {
  listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>;
  action: PersistListingAction;
};

export type ScheduledScanError = {
  userId: string;
  profileId?: string;
  adapter?: string;
  listingUrl?: string;
  message: string;
};

export type ScheduledScanSummary = {
  userId: string;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ScheduledScanError[];
};

export async function processManualListing(userId: string, url: string) {
  const adapter = getAdapterForUrl(url);
  const extracted = await adapter.extractListing(url);
  const profile = await findBestProfileForListing(userId, extracted);
  const result = await persistListing(userId, extracted, profile);
  return result.listing;
}

export async function runScheduledScan(userId: string): Promise<ScheduledScanSummary> {
  const summary: ScheduledScanSummary = {
    userId,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  const profiles = await prisma.searchProfile.findMany({
    where: { userId, active: true }
  });

  for (const profile of profiles) {
    for (const adapter of portalAdapters) {
      let extractedListings: PortalListing[] = [];
      try {
        extractedListings = (await adapter.searchListings?.(profile.id)) ?? [];
      } catch (error) {
        await recordScanError(summary, {
          userId,
          profileId: profile.id,
          adapter: adapter.portal,
          message: safeErrorMessage(error)
        });
        continue;
      }

      for (const extracted of extractedListings ?? []) {
        summary.processed += 1;
        try {
          const result = await persistListing(userId, extracted, profile);
          summary[result.action] += 1;
        } catch (error) {
          await recordScanError(summary, {
            userId,
            profileId: profile.id,
            adapter: adapter.portal,
            listingUrl: extracted.url,
            message: safeErrorMessage(error)
          });
        }
      }
    }
  }

  return summary;
}

async function findBestProfileForListing(userId: string, extracted: PortalListing) {
  const profiles = await prisma.searchProfile.findMany({
    where: { userId, active: true }
  });

  if (!profiles.length) return null;

  return profiles
    .map((profile) => ({
      profile,
      score: scoreListing({
        price: extracted.price ?? null,
        size: extracted.size ?? null,
        rooms: extracted.rooms ?? null,
        district: extracted.district ?? null,
        title: extracted.title,
        description: extracted.description ?? null,
        searchProfile: profile
      }).score
    }))
    .sort((a, b) => b.score - a.score)[0].profile;
}

async function recordScanError(summary: ScheduledScanSummary, error: ScheduledScanError) {
  summary.errors.push(error);
  console.error("scheduler.scan_error", error);

  await prisma.telegramLog
    .create({
      data: {
        userId: error.userId,
        type: "ERROR",
        message: `Scheduler-Fehler: ${error.message}`,
        payload: {
          profileId: error.profileId,
          adapter: error.adapter,
          listingUrl: error.listingUrl
        }
      }
    })
    .catch((logError) => {
      console.error("scheduler.scan_error_log_failed", {
        userId: error.userId,
        message: safeErrorMessage(logError)
      });
    });
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/(token|secret|password|key)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}

export async function persistListing(
  userId: string,
  extracted: PortalListing,
  profile: SearchProfile | null
): Promise<PersistListingResult> {
  const normalizedUrl = normalizeUrl(extracted.url);
  const profileForScoring = profile ?? (await findBestProfileForListing(userId, extracted));
  const existing = await prisma.listing.findUnique({
    where: { userId_normalizedUrl: { userId, normalizedUrl } }
  });

  if (existing) {
    return handleExistingListing(userId, existing.id, extracted);
  }

  const duplicate = await findDuplicate(userId, extracted);
  const provisional = {
    price: extracted.price ?? null,
    size: extracted.size ?? null,
    rooms: extracted.rooms ?? null,
    district: extracted.district ?? null,
    title: extracted.title,
    description: extracted.description ?? null,
    searchProfile: profileForScoring
  };
  const score = scoreListing(provisional);
  const contactMethod = chooseContactMethod(extracted);

  let listing: Awaited<ReturnType<typeof prisma.listing.create>>;
  try {
    listing = await prisma.listing.create({
      data: {
        userId,
        searchProfileId: profileForScoring?.id,
        portal: extracted.portal,
        url: extracted.url,
        normalizedUrl,
        title: extracted.title,
        price: extracted.price,
        size: extracted.size,
        rooms: extracted.rooms,
        address: extracted.address,
        district: extracted.district,
        provider: extracted.provider,
        images: extracted.images,
        description: extracted.description,
        publishedAt: extracted.publishedAt,
        score: score.score,
        scoreLabel: score.label,
        duplicateOfId: duplicate?.id,
        status: duplicate ? "DUPLICATE" : "NEW",
        contactMethod,
        contactEmail: extracted.contactEmail,
        applicationUrl: extracted.applicationUrl,
        rawData: extracted.rawData
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await prisma.listing.findUnique({
        where: { userId_normalizedUrl: { userId, normalizedUrl } }
      });
      if (raced) {
        return handleExistingListing(userId, raced.id, extracted);
      }
    }
    throw error;
  }

  if (duplicate) return { listing, action: "skipped" };

  await ensureListingApplicationAndNotification(userId, listing);

  return { listing, action: "created" };
}

async function handleExistingListing(
  userId: string,
  listingId: string,
  extracted: PortalListing
): Promise<PersistListingResult> {
  const result = await updateExistingListingFromExtraction(listingId, extracted);
  if (isDuplicateListing(result.listing)) {
    return result;
  }

  const ensured = await ensureListingApplicationAndNotification(userId, result.listing);
  return {
    listing: ensured.listing,
    action: result.action === "updated" || ensured.action === "updated" ? "updated" : "skipped"
  };
}

async function updateExistingListingFromExtraction(
  listingId: string,
  extracted: PortalListing
): Promise<PersistListingResult> {
  const existing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
  const data: Prisma.ListingUpdateInput = {};
  const applicationUrlChanged = Boolean(extracted.applicationUrl && existing.applicationUrl !== extracted.applicationUrl);

  if (applicationUrlChanged) {
    data.applicationUrl = extracted.applicationUrl;
    data.contactMethod = "EXTERNAL";
  }

  if (extracted.applicationUrl && extracted.rawData && (applicationUrlChanged || !existing.rawData)) {
    data.rawData = extracted.rawData;
  }

  if (!Object.keys(data).length) {
    return { listing: existing, action: "skipped" };
  }

  const listing = await prisma.listing.update({
    where: { id: existing.id },
    data
  });

  return { listing, action: "updated" };
}

async function ensureListingApplicationAndNotification(
  userId: string,
  listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>
): Promise<PersistListingResult> {
  const application = await ensureListingApplication(userId, listing);
  const alreadyLogged = await hasListingFoundLog(userId, listing);
  let changed = application.created;
  let currentListing = listing;

  if (shouldSendListingNotification(listing, application.created) && !alreadyLogged) {
    await sendListingFoundTelegram(userId, listing);
    currentListing = await prisma.listing.update({
      where: { id: listing.id },
      data: { status: "NOTIFIED" }
    });
    changed = true;
  } else if (shouldMarkListingNotified(listing) && alreadyLogged) {
    currentListing = await prisma.listing.update({
      where: { id: listing.id },
      data: { status: "NOTIFIED" }
    });
    changed = true;
  }

  if (application.created) {
    await evaluateAutoApplyDryRun(userId, listing.id, application.id);
  }

  return { listing: currentListing, action: changed ? "updated" : "skipped" };
}

async function ensureListingApplication(
  userId: string,
  listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>
) {
  const existingApplication = await prisma.application.findFirst({
    where: { userId, listingId: listing.id },
    select: { id: true }
  });

  if (existingApplication) {
    return { id: existingApplication.id, created: false };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const message = await generateApplicationMessage(user, listing);
  const application = await prisma.application.create({
    data: {
      userId,
      listingId: listing.id,
      status: "PENDING_APPROVAL",
      message
    },
    select: { id: true }
  });

  return { id: application.id, created: true };
}

async function hasListingFoundLog(
  userId: string,
  listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>
) {
  const log = await prisma.telegramLog.findFirst({
    where: {
      userId,
      type: "LISTING_FOUND",
      OR: [
        { message: { contains: listing.id } },
        { message: { contains: listing.url } },
        { payload: { path: ["listingId"], equals: listing.id } },
        { payload: { path: ["url"], equals: listing.url } }
      ]
    },
    select: { id: true }
  });

  return Boolean(log);
}

async function sendListingFoundTelegram(
  userId: string,
  listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>
) {
  await sendTelegramMessage(
    userId,
    [
      "🏠 Neue Wohnung",
      "",
      `<b>${escapeHtml(listing.title)}</b>`,
      `Preis: ${formatCurrency(listing.price)}`,
      `Ort: ${escapeHtml(listing.address ?? listing.district ?? "-")}`,
      `Score: ${listing.score} (${escapeHtml(listing.scoreLabel)})`,
      "",
      escapeHtml(listing.url)
    ].join("\n"),
    listingButtons(listing.id)
  );

  if (!(await hasListingFoundLog(userId, listing))) {
    throw new Error("Telegram-Benachrichtigung wurde nicht als LISTING_FOUND bestaetigt.");
  }
}

function shouldSendListingNotification(
  listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>,
  applicationCreated: boolean
) {
  if (["APPLIED", "IGNORED", "DUPLICATE"].includes(listing.status)) {
    return false;
  }

  return applicationCreated || shouldMarkListingNotified(listing);
}

function shouldMarkListingNotified(listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>) {
  return !["NOTIFIED", "APPLIED", "IGNORED", "DUPLICATE"].includes(listing.status);
}

function isDuplicateListing(listing: Awaited<ReturnType<typeof prisma.listing.findUniqueOrThrow>>) {
  return listing.status === "DUPLICATE" || Boolean(listing.duplicateOfId);
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function evaluateAutoApplyDryRun(userId: string, listingId: string, applicationId: string) {
  const [user, settings, listing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.settings.findUnique({ where: { userId } }),
    prisma.listing.findUnique({ where: { id: listingId } })
  ]);

  if (!user || !settings?.autoApplyEnabled || !listing) return;

  const reasons = [];
  const contactEmail = user.contactEmail || user.email;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const isDirectImmobilie1Form =
    listing.portal === "IMMOBILIE1" && listing.contactMethod === "FORM" && !listing.applicationUrl;

  if (listing.score < settings.autoApplyMinScore) {
    reasons.push(`Score ${listing.score} unter Schwelle ${settings.autoApplyMinScore}`);
  }
  if (!isDirectImmobilie1Form) {
    reasons.push("Kontaktpfad nicht auto-send-fähig");
  }
  if (!fullName) {
    reasons.push("Vorname/Nachname fehlen");
  }
  if (!contactEmail || contactEmail === "you@example.com") {
    reasons.push("Kontakt-E-Mail fehlt oder ist noch Demo-Adresse");
  }
  if (!user.salutation) {
    reasons.push("Anrede fehlt");
  }

  const limit = await canSendApplication(userId);
  if (!limit.allowed) {
    reasons.push(`Rate Limit erreicht: ${limit.hourCount}/${limit.maxPerHour} pro Stunde, ${limit.dayCount}/${limit.maxPerDay} pro Tag`);
  }

  const eligible = reasons.length === 0;
  const note = eligible
    ? `Auto-Modus Dry-Run: würde diese Bewerbung automatisch abschicken (Score ${listing.score}).`
    : `Auto-Modus Dry-Run: nicht automatisch sendbar (${reasons.join("; ")}).`;

  await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: {
        externalStatus: note,
        externalPayload: {
          autoApplyDryRun: true,
          eligible,
          reasons,
          score: listing.score,
          minScore: settings.autoApplyMinScore,
          contactPath: isDirectImmobilie1Form ? "IMMOBILIE1_CONTACT_FORM" : "MANUAL"
        }
      }
    }),
    prisma.telegramLog.create({
      data: {
        userId,
        type: "ACTION",
        message: note,
        payload: {
          applicationId,
          listingId,
          eligible,
          reasons
        }
      }
    })
  ]);

  if (eligible) {
    await sendTelegramMessage(
      userId,
      [
        "🤖 Auto-Modus Dry-Run",
        "",
        `<b>${escapeHtml(listing.title)}</b>`,
        `Score: ${listing.score} (${escapeHtml(listing.scoreLabel)})`,
        "",
        "Diese Bewerbung würde automatisch abgeschickt. Es wurde noch nichts gesendet."
      ].join("\n"),
      listingButtons(listing.id)
    );
  }
}

async function findDuplicate(userId: string, extracted: PortalListing) {
  const clauses: Prisma.ListingWhereInput[] = [
    {
      title: extracted.title,
      provider: extracted.provider
    }
  ];

  if (extracted.address) {
    clauses.unshift({
      address: extracted.address,
      title: extracted.title,
      provider: extracted.provider
    });
  }

  return prisma.listing.findFirst({
    where: {
      userId,
      OR: clauses
    }
  });
}

function chooseContactMethod(extracted: PortalListing): ContactMethod {
  if (extracted.applicationUrl) {
    return "EXTERNAL";
  }

  const text = `${extracted.title} ${extracted.description ?? ""}`.toLowerCase();
  if (extracted.contactEmail || emailHints.some((hint) => text.includes(hint))) {
    return "EMAIL";
  }
  return "FORM";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
