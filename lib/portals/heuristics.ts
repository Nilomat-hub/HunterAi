export type ListingPageSignal = {
  title?: string;
  description?: string;
  allText: string;
  links: Array<{ text: string; href: string }>;
};

export type ContactPerson = {
  salutation?: string;
  name: string;
};

const unavailablePatterns = [
  /die immobilie,? die sie suchen,? ist leider nicht mehr verf(?:ue|\u00fc)gbar/i,
  /das inserat ist leider nicht mehr verf(?:ue|\u00fc)gbar/i,
  /diese anzeige ist leider nicht mehr verf(?:ue|\u00fc)gbar/i,
  /dieses angebot wurde bereits deaktiviert/i,
  /anzeige wurde deaktiviert/i,
  /inserat wurde deaktiviert/i,
  /objekt ist nicht mehr verf(?:ue|\u00fc)gbar/i,
  /angebot ist nicht mehr verf(?:ue|\u00fc)gbar/i,
  /nicht mehr verf(?:ue|\u00fc)gbar/i,
  /nicht l(?:ae|\u00e4)nger verf(?:ue|\u00fc)gbar/i,
  /wurde (?:bereits )?(?:gel(?:oe|\u00f6)scht|deaktiviert|vermietet|vergeben)/i,
  /seite wurde deaktiviert/i
];

const searchPagePatterns = [
  /\bsuchergebnisse\b/i,
  /\bfilter\b.*\bsortieren\b/i,
  /\bwohnungen zur miete\b.*\bfilter\b/i,
  /\b\d+[\.,]?\d*\s+wohnungen zur miete\b/i
];

const replacementPagePatterns = [
  /\b(?:aehnliche|\u00e4hnliche)\s+(?:angebote|immobilien|wohnungen)\b/i,
  /\balternative\s+(?:angebote|immobilien|wohnungen)\b/i,
  /\bfinden sie (?:aehnliche|\u00e4hnliche)\b/i
];

const obviousSearchPagePatterns = [
  /\bsuchergebnisse\b/i,
  /\bfilter\b.*\bsortieren\b/i,
  /\b\d+[\.,]?\d*\s+wohnungen zur miete\b/i
];

const searchControlPatterns = [
  /\bsuchergebnisse\b/i,
  /\bfilter\b/i,
  /\bsortieren\b/i
];

const contactActionPatterns = [
  /\bonline\s+bewerbung\b/i,
  /\bjetzt\s+bewerben\b/i,
  /\banfrage\s+senden\b/i,
  /\bkontakt\s+aufnehmen\b/i,
  /\banbieter\s+kontaktieren\b/i,
  /\bbesichtigung\s+vereinbaren\b/i,
  /\btermin\s+vereinbaren\b/i,
  /\bnachricht\s+senden\b/i,
  /\bexpos(?:e|\u00e9)\s+anfordern\b/i,
  /\bformular\s+ausfuellen\b/i
];

const listingSignals = [
  /\bwarmmiete\b/i,
  /\bkaltmiete\b/i,
  /\bgesamtmiete\b/i,
  /\bzimmer\b/i,
  /\b(?:m\u00b2|m2|qm)\b/i,
  /\banbieter kontaktieren\b/i,
  /\bexpos(?:e|\u00e9)\b/i
];

const companyWords = [
  "Immobilien",
  "Vertrieb",
  "GmbH",
  "AG",
  "KG",
  "UG",
  "Anbieter",
  "Kontaktieren",
  "Details",
  "Wohnung",
  "Kontakt",
  "Informationen",
  "Team"
];

export function isUnavailableListingPage(text: string) {
  const normalized = normalizeWhitespace(text);
  return unavailablePatterns.some((pattern) => pattern.test(normalized));
}

export function looksLikeListingPage(signal: ListingPageSignal) {
  const title = normalizeWhitespace(signal.title ?? "");
  const allText = normalizeWhitespace(signal.allText);
  const combined = normalizeWhitespace(`${signal.title ?? ""} ${signal.description ?? ""} ${signal.allText}`);
  if (isUnavailableListingPage(combined)) return false;

  const looksLikeSearch = searchPagePatterns.some((pattern) => pattern.test(combined));
  const looksLikeReplacement = replacementPagePatterns.some((pattern) => pattern.test(combined));
  const obviousSearchPage = obviousSearchPagePatterns.some((pattern) => pattern.test(allText));
  const obviousReplacementPage = replacementPagePatterns.some((pattern) => pattern.test(allText));
  const signalCount = listingSignals.filter((pattern) => pattern.test(combined)).length;
  const hasApplicationLink = signal.links.some((link) => /bewerben|kontakt|expos/i.test(`${link.text} ${link.href}`));
  const titleLooksSearch = /\bsuche\b|\bsuchergebnisse\b|immobilienportal/i.test(title);
  const titleLooksCategorySearch = /^wohnungen zur miete\b/i.test(title);
  const searchControlCount = searchControlPatterns.filter((pattern) => pattern.test(allText)).length;

  if (titleLooksCategorySearch && searchControlCount >= 2) return false;
  if (titleLooksSearch || obviousSearchPage || obviousReplacementPage) return false;
  if ((looksLikeSearch || looksLikeReplacement) && signalCount < 2 && !hasApplicationLink) return false;

  return signalCount > 0 || hasApplicationLink;
}

export function extractContactPerson(text: string): ContactPerson | undefined {
  const normalized = normalizeWhitespace(text);
  const patterns = [
    /\bAnsprechpartner(?:in)?[:\s]+(?:(Frau|Herr)\s+)?([A-Z\u00c4\u00d6\u00dc][A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df.'-]+(?:\s+[A-Z\u00c4\u00d6\u00dc][A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df.'-]+){1,2})\b/i,
    /\bKontaktperson[:\s]+(?:(Frau|Herr)\s+)?([A-Z\u00c4\u00d6\u00dc][A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df.'-]+(?:\s+[A-Z\u00c4\u00d6\u00dc][A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df.'-]+){1,2})\b/i,
    /\b(Frau|Herr)\s+([A-Z\u00c4\u00d6\u00dc][A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df.'-]+\s+[A-Z\u00c4\u00d6\u00dc][A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df.'-]+)\b(?=.{0,80}\b(?:Ansprechpartner|Kontaktperson|Kontakt)\b)/i
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
    .replace(/\b(?:Kontakt|Kontaktieren|Anbieter|Details|Telefon|E-Mail|Email)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleContactName(name: string) {
  const parts = name.split(/\s+/);
  return (
    name.length <= 80 &&
    parts.length >= 2 &&
    parts.length <= 3 &&
    !contactActionPatterns.some((pattern) => pattern.test(name)) &&
    !companyWords.some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(name))
  );
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
