import type { Portal } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type ExtractedListing = {
  portal: Portal;
  url: string;
  title: string;
  price?: number;
  size?: number;
  rooms?: number;
  address?: string;
  district?: string;
  provider?: string;
  images: string[];
  description?: string;
  publishedAt?: Date;
  contactEmail?: string;
  applicationUrl?: string;
  rawData?: Prisma.InputJsonObject;
};

export type PortalAdapter = {
  portal: Portal;
  supportsUrl(url: string): boolean;
  extractListing(url: string): Promise<ExtractedListing>;
  searchListings?(profileId: string): Promise<ExtractedListing[]>;
};
