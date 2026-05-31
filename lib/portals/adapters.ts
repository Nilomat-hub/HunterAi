import { Portal } from "@prisma/client";
import { extractGenericListing } from "@/lib/portals/common";
import type { PortalAdapter } from "@/lib/portals/types";

const domains: Partial<Record<Portal, string[]>> = {
  IMMOSCOUT24: ["immobilienscout24.de", "immoscout24.de"],
  IMMOWELT: ["immowelt.de"],
  IMMONET: ["immonet.de"],
  MEINESTADT: ["meinestadt.de"],
  IMMOBILIE1: ["immobilie1.de"]
};

function createAdapter(portal: Portal): PortalAdapter {
  return {
    portal,
    supportsUrl(url) {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return domains[portal]?.some((domain) => hostname.endsWith(domain)) ?? false;
    },
    extractListing(url) {
      return extractGenericListing(url, portal);
    },
    async searchListings() {
      // Portal-specific search pages need account/session handling. The pipeline is ready;
      // adapters can be extended one portal at a time without changing the scheduler.
      return [];
    }
  };
}

export const portalAdapters = [
  createAdapter(Portal.IMMOSCOUT24),
  createAdapter(Portal.IMMOWELT),
  createAdapter(Portal.IMMONET),
  createAdapter(Portal.MEINESTADT),
  createAdapter(Portal.IMMOBILIE1)
];

export function getAdapterForUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Bitte eine gültige Inserat-URL eingeben.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Nur HTTP- und HTTPS-URLs werden unterstützt.");
  }

  const adapter = portalAdapters.find((candidate) => candidate.supportsUrl(url));
  if (!adapter) {
    throw new Error("Dieses Portal wird noch nicht unterstützt.");
  }

  return adapter;
}
