import type { Listing, SearchProfile } from "@prisma/client";

export type ScoreInput = Pick<Listing, "price" | "size" | "rooms" | "district" | "description" | "title"> & {
  searchProfile?: Pick<SearchProfile, "maxPrice" | "minSize" | "rooms" | "districts" | "keywords"> | null;
};

export function scoreListing(input: ScoreInput) {
  const profile = input.searchProfile;

  const priceScore = profile?.maxPrice && input.price ? clamp((profile.maxPrice / input.price) * 30, 0, 30) : 15;
  const locationScore = scoreLocation(input.district, profile?.districts) * 25;
  const roomScore = profile?.rooms && input.rooms ? clamp(1 - Math.abs(profile.rooms - input.rooms) / 3, 0, 1) * 20 : 10;
  const sizeScore = profile?.minSize && input.size ? clamp(input.size / profile.minSize, 0, 1) * 15 : 8;
  const keywordScore = scoreKeywords(`${input.title} ${input.description ?? ""}`, profile?.keywords) * 10;

  const score = Math.round(priceScore + locationScore + roomScore + sizeScore + keywordScore);

  return {
    score: clamp(score, 0, 100),
    label: scoreLabel(score)
  };
}

export function scoreLabel(score: number) {
  if (score >= 90) return "Perfekter Treffer";
  if (score >= 80) return "Sehr gut";
  if (score >= 70) return "Gut";
  if (score >= 60) return "Mittel";
  return "Niedrige Priorität";
}

function scoreLocation(district?: string | null, districts?: string[]) {
  if (!districts?.length) return 0.6;
  if (!district) return 0.4;
  return districts.some((item) => district.toLowerCase().includes(item.toLowerCase())) ? 1 : 0.35;
}

function scoreKeywords(text: string, keywords?: string[]) {
  if (!keywords?.length) return 0.5;
  const lower = text.toLowerCase();
  const hits = keywords.filter((keyword) => lower.includes(keyword.toLowerCase())).length;
  return clamp(hits / keywords.length, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
