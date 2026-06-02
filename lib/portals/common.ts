import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import type { ExtractedListing } from "@/lib/portals/types";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

type BrowserListingData = {
  title?: string;
  description?: string;
  mainText?: string;
  allText: string;
  jsonLd: string[];
  images: string[];
  links: Array<{ text: string; href: string }>;
};

export async function extractGenericListing(url: string, portal: ExtractedListing["portal"]) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: getLocalChromiumPath()
  });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

    const data = await page.evaluate<BrowserListingData>(`(() => {
      const clean = (value) => value?.replace(/\\s+/g, " ").trim() || undefined;
      const text = (selector) => clean(document.querySelector(selector)?.textContent);
      const meta = (name) =>
        document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]')?.content;

      const allText = clean(document.body?.innerText) || "";
      const descriptionCandidates = Array.from(
        document.querySelectorAll('[data-testid*="description" i], [class*="description" i], [id*="description" i], article, main')
      )
        .map((node) => clean(node.textContent))
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);

      const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map((script) => script.textContent)
        .filter(Boolean);

      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => img.currentSrc || img.src)
        .filter(Boolean)
        .slice(0, 12);

      const links = Array.from(document.querySelectorAll("a"))
        .map((link) => ({
          text: clean(link.textContent) || "",
          href: link.href || ""
        }))
        .filter((link) => link.href);

      return {
        title: text("h1") || meta("og:title") || document.title,
        description: meta("og:description") || descriptionCandidates[0] || allText.slice(0, 3000),
        mainText: descriptionCandidates[0],
        allText,
        jsonLd,
        images,
        links
      };
    })()`);

    const structured = parseJsonLd(data.jsonLd);
    const combinedText = normalizeWhitespace(`${data.title} ${data.description} ${data.mainText ?? ""} ${data.allText}`);
    const rawTitle = firstString(structured.name, data.title) || "Unbenanntes Inserat";
    const titleQuality = getTitleQuality(rawTitle);
    const title = titleQuality.usable ? rawTitle : "Wohnungsinserat";
    const address = firstString(
      structured.address?.streetAddress,
      structured.address?.addressLocality,
      parseAddress(combinedText)
    );
    const details = extractListingDetails(combinedText, data.links);

    return {
      portal,
      url,
      title,
      price: details.rent.warmRent ?? parseEuro(firstString(structured.offers?.price, findMatch(combinedText, pricePattern()))),
      size: parseNumber(findMatch(combinedText, /(\d+(?:[,.]\d+)?)\s*(?:m(?:\u00b2|2)|qm)/i)),
      rooms: parseNumber(findMatch(combinedText, /(\d+(?:[,.]\d+)?)\s*(?:Zimmer|Zi\.)/i)),
      address,
      district: parseDistrict(rawTitle, address),
      provider: firstString(structured.seller?.name, structured.provider?.name),
      images: data.images,
      description: cleanDescription(data.description),
      contactEmail: findMatch(combinedText, emailPattern),
      applicationUrl: findApplicationUrl(data.links, combinedText),
      rawData: {
        structured,
        links: data.links.slice(0, 80),
        details,
        quality: {
          title: titleQuality,
          descriptionLength: cleanDescription(data.description)?.length ?? 0
        },
        extractedAt: new Date().toISOString()
      }
    } satisfies ExtractedListing;
  } finally {
    await browser.close();
  }
}

function extractListingDetails(text: string, links: Array<{ text: string; href: string }>) {
  return {
    rent: {
      warmRent: findEuroByLabels(text, ["Warmmiete", "Gesamtmiete"]),
      coldRent: findEuroByLabels(text, ["Kaltmiete", "Nettokaltmiete", "Miete zzgl. NK"]),
      additionalCosts: findEuroByLabels(text, ["Nebenkosten", "Betriebskosten"]),
      heatingCosts: findEuroByLabels(text, ["Heizkosten"]),
      deposit: findEuroByLabels(text, ["Kaution", "Mietsicherheit"])
    },
    features: detectFeatures(text),
    contactHints: detectContactHints(text, links),
    contactPerson: extractContactPerson(text)
  };
}

function extractContactPerson(text: string) {
  const normalized = normalizeWhitespace(text);
  const patterns = [
    /\b(Frau|Herr)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+){0,3})\b/,
    /\bAnsprechpartner(?:in)?[:\s]+(Frau|Herr)?\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+){0,3})\b/i,
    /\bKontakt(?:person)?[:\s]+(Frau|Herr)?\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+){0,3})\b/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const salutation = match[1]?.trim();
    const name = cleanContactName(match[2]);
    if (name && isPlausibleContactName(name)) {
      return { salutation, name };
    }
  }

  return undefined;
}

function cleanContactName(value?: string) {
  if (!value) return undefined;
  return value
    .replace(/\b(?:Wentzel\s+Dr|Vertriebs|Immobilien|GmbH|AG|KG|Details|Anbieter|Kontaktieren)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleContactName(name: string) {
  const blocked = ["Immobilien", "Vertrieb", "GmbH", "Details", "Anbieter", "Kontaktieren"];
  return name.length <= 80 && !blocked.some((word) => name.includes(word));
}

function detectFeatures(text: string) {
  const normalized = text.toLowerCase();
  return {
    balcony: hasAny(normalized, ["balkon", "loggia", "terrasse"]),
    fittedKitchen: hasAny(normalized, ["einbauk\u00fcche", "ebk", "k\u00fcche"]),
    elevator: hasAny(normalized, ["aufzug", "fahrstuhl"]),
    cellar: hasAny(normalized, ["keller", "kellerraum"]),
    parking: hasAny(normalized, ["stellplatz", "garage", "tiefgarage"]),
    garden: hasAny(normalized, ["garten", "gartennutzung"]),
    barrierFree: hasAny(normalized, ["barrierefrei", "rollstuhlgerecht"]),
    floorHeating: hasAny(normalized, ["fu\u00dfbodenheizung", "fussbodenheizung"])
  };
}

function detectContactHints(text: string, links: Array<{ text: string; href: string }>) {
  const normalized = text.toLowerCase();
  const linkLabels = links.map((link) => link.text.toLowerCase()).join(" ");
  return {
    hasExternalApplication: hasAny(`${normalized} ${linkLabels}`, ["interessentenlink", "digital bewerben", "online bewerben"]),
    hasViewingMention: hasAny(normalized, ["besichtigung", "besichtigungstermin"]),
    hasDocumentsMention: hasAny(normalized, ["unterlagen", "schufa", "gehaltsnachweis", "mieterselbstauskunft"])
  };
}

function findEuroByLabels(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}[^\\d]{0,40}(\\d[\\d.]*[,\\d]{0,3})\\s*(?:\\u20ac|EUR)`, "i");
    const value = parseEuro(text.match(pattern)?.[1]);
    if (value) return value;
  }
  return undefined;
}

function findApplicationUrl(links: Array<{ text: string; href: string }>, text: string) {
  const candidate = links.find((link) => {
    const label = link.text.toLowerCase();
    const href = link.href.toLowerCase();
    return (
      label.includes("interessentenlink") ||
      label.includes("bewerben") ||
      label.includes("digital") ||
      href.includes("tenant.immomio.com/apply") ||
      href.includes("/apply/") ||
      href.includes("bewerb")
    );
  });

  if (candidate?.href && /^https?:\/\//i.test(candidate.href)) return candidate.href;

  return text.match(/https?:\/\/[^\s]+(?:apply|bewerb|immomio)[^\s]*/i)?.[0];
}

function getLocalChromiumPath() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (configured && fs.existsSync(configured)) return configured;

  const local = path.join(process.cwd(), ".playwright-runtime", "chromium-1223", "chrome-win64", "chrome.exe");
  if (fs.existsSync(local)) return local;

  return undefined;
}

function parseJsonLd(items: string[]) {
  for (const item of items) {
    try {
      const parsed = JSON.parse(item);
      if (Array.isArray(parsed)) return parsed[0] ?? {};
      if (parsed["@graph"] && Array.isArray(parsed["@graph"])) return parsed["@graph"][0] ?? {};
      return parsed;
    } catch {
      // Ignore malformed JSON-LD from portals.
    }
  }
  return {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function findMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? value.match(pattern)?.[0];
}

function parseEuro(value?: string) {
  if (!value) return undefined;
  return Math.round(parseNumber(value) ?? 0) || undefined;
}

function parseNumber(value?: string) {
  if (!value) return undefined;
  const normalized = value.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAddress(value: string) {
  const streetTypes = "stra(?:\\u00dfe|sse)|allee|weg|platz|ring|damm|chaussee|ufer|stieg|gasse|kamp|reihe|markt";
  const pattern = new RegExp(
    `([A-Z\\u00c4\\u00d6\\u00dc][A-Za-z\\u00c4\\u00d6\\u00dc\\u00e4\\u00f6\\u00fc\\u00df.\\-]+\\s+(?:${streetTypes})\\s*\\d*[A-Za-z]?\\s*\\u00b7\\s*\\d{5}\\s*\\u00b7\\s*[^\\u00b7]{2,50}\\s*\\u00b7\\s*Deutschland)`,
    "i"
  );

  return value.match(pattern)?.[1]?.replace(/\s+/g, " ").trim();
}

function parseDistrict(title?: string, address?: string) {
  const fromTitle = title?.match(
    /\b(?:in|Hamburg-|Berlin-|M(?:\u00fcnchen|uenchen)-|Koeln-|K(?:\u00f6|oe)ln-)([A-Z\u00c4\u00d6\u00dc][A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df -]{2,40})\b/
  )?.[1];
  if (fromTitle) return fromTitle.trim();
  return address?.match(/\u00b7 \d{5} \u00b7 ([^\u00b7]+) \u00b7/)?.[1]?.trim();
}

function cleanDescription(value?: string) {
  if (!value) return undefined;
  const cleaned = normalizeWhitespace(value);
  return cleaned.length > 4000 ? `${cleaned.slice(0, 3997)}...` : cleaned;
}

function getTitleQuality(title: string) {
  const normalized = normalizeWhitespace(title);
  const hasEnoughSignal = normalized.length >= 8;
  const brokenWords = normalized.match(/\b[A-Za-z]\s+[A-Za-z]{1,3}\s+[A-Za-z]{1,3}\b/g)?.length ?? 0;
  const repeatedSeparators = /[-_|]{3,}/.test(normalized);
  return {
    usable: hasEnoughSignal && brokenWords < 2 && !repeatedSeparators,
    reason: !hasEnoughSignal ? "too_short" : brokenWords >= 2 ? "broken_spacing" : repeatedSeparators ? "noisy" : "ok",
    original: normalized
  };
}

function pricePattern() {
  return /(\d[\d.]{2,})\s*(?:\u20ac|EUR)/i;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}
