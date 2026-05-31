import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.searchParams.sort();
  return parsed.toString().replace(/\/$/, "");
}

export function formatCurrency(value?: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}
