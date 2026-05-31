import type { Prisma } from "@prisma/client";

type ListingDetails = {
  rent?: {
    warmRent?: number | null;
    coldRent?: number | null;
    additionalCosts?: number | null;
    heatingCosts?: number | null;
    deposit?: number | null;
  };
  features?: Record<string, boolean>;
  contactHints?: Record<string, boolean>;
};

const featureLabels: Record<string, string> = {
  balcony: "Balkon/Terrasse",
  fittedKitchen: "Einbaukueche",
  elevator: "Aufzug",
  cellar: "Keller",
  parking: "Stellplatz",
  garden: "Garten",
  barrierFree: "barrierefrei",
  floorHeating: "Fussbodenheizung"
};

export function getListingDetails(rawData: Prisma.JsonValue | null | undefined): ListingDetails | null {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) return null;
  const details = (rawData as { details?: unknown }).details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  return details as ListingDetails;
}

export function formatDetectedFeatures(details: ListingDetails | null) {
  if (!details?.features) return [];
  return Object.entries(details.features)
    .filter(([, detected]) => detected)
    .map(([key]) => featureLabels[key] ?? key)
    .slice(0, 4);
}

export function formatRentDetails(details: ListingDetails | null) {
  const rent = details?.rent;
  if (!rent) return [];

  return [
    rent.coldRent ? `Kalt ${formatEuro(rent.coldRent)}` : null,
    rent.additionalCosts ? `NK ${formatEuro(rent.additionalCosts)}` : null,
    rent.deposit ? `Kaution ${formatEuro(rent.deposit)}` : null
  ].filter(Boolean) as string[];
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}
