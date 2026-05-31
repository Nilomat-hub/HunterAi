import type { ContactMethod, Prisma, SearchProfile } from "@prisma/client";
import { generateApplicationMessage } from "@/lib/ai/applications";
import { prisma } from "@/lib/db/prisma";
import { getAdapterForUrl, portalAdapters } from "@/lib/portals/adapters";
import type { ExtractedListing as PortalListing } from "@/lib/portals/types";
import { scoreListing } from "@/lib/scoring/score";
import { listingButtons, sendTelegramMessage } from "@/lib/telegram/client";
import { formatCurrency, normalizeUrl } from "@/lib/utils";

const emailHints = ["besser unter", "bitte per mail", "kontakt per e-mail", "kontakt per email"];

export async function processManualListing(userId: string, url: string) {
  const adapter = getAdapterForUrl(url);
  const extracted = await adapter.extractListing(url);
  return persistListing(userId, extracted, null);
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

export async function persistListing(userId: string, extracted: PortalListing, profile: SearchProfile | null) {
  const normalizedUrl = normalizeUrl(extracted.url);
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
    searchProfile: profile
  };
  const score = scoreListing(provisional);
  const contactMethod = chooseContactMethod(extracted);

  const listing = await prisma.listing.create({
    data: {
      userId,
      searchProfileId: profile?.id,
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

  await prisma.application.create({
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

  return listing;
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
