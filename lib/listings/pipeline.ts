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

export async function processManualListing(userId: string, url: string) {
  const adapter = getAdapterForUrl(url);
  const extracted = await adapter.extractListing(url);
  const profile = await findBestProfileForListing(userId, extracted);
  return persistListing(userId, extracted, profile);
}

export async function runScheduledScan(userId: string) {
  const profiles = await prisma.searchProfile.findMany({
    where: { userId, active: true }
  });

  const results = [];
  for (const profile of profiles) {
    for (const adapter of portalAdapters) {
      const extractedListings = await adapter.searchListings?.(profile.id);
      for (const extracted of extractedListings ?? []) {
        results.push(await persistListing(userId, extracted, profile));
      }
    }
  }

  return results;
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

export async function persistListing(userId: string, extracted: PortalListing, profile: SearchProfile | null) {
  const normalizedUrl = normalizeUrl(extracted.url);
  const profileForScoring = profile ?? (await findBestProfileForListing(userId, extracted));
  const existing = await prisma.listing.findUnique({
    where: { userId_normalizedUrl: { userId, normalizedUrl } }
  });

  if (existing) {
    if (extracted.applicationUrl && existing.applicationUrl !== extracted.applicationUrl) {
      return prisma.listing.update({
        where: { id: existing.id },
        data: {
          applicationUrl: extracted.applicationUrl,
          contactMethod: "EXTERNAL",
          rawData: extracted.rawData
        }
      });
    }

    return existing;
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

  const listing = await prisma.listing.create({
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

  if (duplicate) return listing;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const message = await generateApplicationMessage(user, listing);

  const application = await prisma.application.create({
    data: {
      userId,
      listingId: listing.id,
      status: "PENDING_APPROVAL",
      message
    }
  });

  await prisma.listing.update({
    where: { id: listing.id },
    data: { status: "NOTIFIED" }
  });

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

  await evaluateAutoApplyDryRun(userId, listing.id, application.id);

  return listing;
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
