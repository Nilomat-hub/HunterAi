import OpenAI from "openai";
import type { Listing, User } from "@prisma/client";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "missing-key"
});

export async function generateApplicationMessage(user: User, listing: Listing) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackMessage(user, listing);
  }

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "Du schreibst kurze, natürliche und professionelle Wohnungsbewerbungen auf Deutsch. Zitiere den Inseratstitel nicht wörtlich. Nutze nur robuste Fakten wie Stadtteil, Lage, Größe, Zimmer und Ausstattung. Keine Floskeln, kein übertriebener Ton, maximal 170 Wörter."
        },
        {
          role: "user",
          content: JSON.stringify({
            profil: {
              vorname: user.firstName,
              nachname: user.lastName,
              alter: user.age,
              beruf: user.occupation,
              studiumOderAusbildung: user.dualStudyProgram,
              arbeitgeber: user.employer,
              monatlichVerfuegbar: user.monthlyAvailableBudget ?? user.netIncome,
              buergschaftMoeglich: user.guarantorAvailable,
              haushaltsgroesse: user.householdSize,
              haustiere: user.pets,
              einzugsdatum: user.moveInDate,
              aktuelleSituation: user.currentHousingSituation,
              umzugsgrund: user.moveReason,
              lagevorteil: user.locationBenefit,
              beschreibung: user.personalBio
            },
            inserat: {
              titelNurAlsKontext: safeListingTitle(listing.title),
              preis: listing.price,
              groesse: listing.size,
              zimmer: listing.rooms,
              adresse: listing.address,
              stadtteil: listing.district,
              beschreibung: listing.description
            }
          })
        }
      ]
    });

    return response.choices[0]?.message.content?.trim() || fallbackMessage(user, listing);
  } catch (error) {
    console.warn("OpenAI application generation failed. Falling back to local template.", error);
    return fallbackMessage(user, listing);
  }
}

export function fallbackMessage(user: User, listing: Listing) {
  const intro = buildIntro(user);
  const situation = buildSituation(user);
  const location = buildLocationSentence(user, listing);
  const finances = buildFinanceSentence(user);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return [
    "Guten Tag,",
    "",
    "die Wohnung hat direkt mein Interesse geweckt, weil sie gut zu meiner aktuellen Lebenssituation passt.",
    intro,
    situation,
    location,
    finances,
    "Ich freue mich, wenn Sie mich bei der Vergabe berücksichtigen, und sende Ihnen gerne alle benötigten Unterlagen zu.",
    "",
    "Mit freundlichen Grüßen",
    name || undefined
  ]
    .filter((line) => line !== undefined)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function safeListingTitle(title?: string | null) {
  if (!title) return undefined;
  const normalized = title.replace(/\s+/g, " ").trim();
  if (normalized.length < 12) return undefined;
  if (looksBroken(normalized)) return undefined;
  return normalized;
}

function buildIntro(user: User) {
  const study = user.dualStudyProgram || user.occupation;
  const prefix = user.age ? `Ich bin ${user.age} Jahre alt` : "Ich";

  if (study && user.employer) {
    return `${prefix}, studiere dual ${study} in Hamburg und arbeite bei ${user.employer}.`;
  }

  if (study) return `${prefix}, studiere ${study}.`;
  if (user.employer) return `${prefix} arbeite bei ${user.employer}.`;
  return user.age ? `${prefix}.` : undefined;
}

function buildSituation(user: User) {
  if (user.currentHousingSituation && user.moveReason) {
    return `${user.currentHousingSituation} ${user.moveReason}`;
  }
  return user.currentHousingSituation || user.moveReason || undefined;
}

function buildLocationSentence(user: User, listing: Listing) {
  const benefit =
    user.locationBenefit ||
    "dass ich von dort aus schneller und unkomplizierter zur Arbeit und zur Hochschule komme";

  if (listing.district) {
    return `An der Lage in ${listing.district} gefällt mir besonders, ${benefit}.`;
  }

  if (listing.address) {
    return `An der Lage gefällt mir besonders, ${benefit}.`;
  }

  return `An einer gut angebundenen Lage gefällt mir besonders, ${benefit}.`;
}

function buildFinanceSentence(user: User) {
  const budget = user.monthlyAvailableBudget ?? user.netIncome;
  const budgetPart = budget
    ? `Finanziell bin ich mit ca. ${new Intl.NumberFormat("de-DE").format(
        budget
      )} € monatlich zuverlässig verfügbarem Budget gut aufgestellt`
    : undefined;
  const guarantorPart = user.guarantorAvailable
    ? "bei Bedarf würden meine Eltern zusätzlich eine Bürgschaft übernehmen"
    : undefined;

  if (budgetPart && guarantorPart) return `${budgetPart}; ${guarantorPart}.`;
  if (budgetPart) return `${budgetPart}.`;
  if (guarantorPart) return `Finanziell besteht zusätzliche Sicherheit: ${guarantorPart}.`;
  return undefined;
}

function looksBroken(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  const suspiciousWords = words.filter((word) => {
    if (word.length < 4) return false;
    const letters = word.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
    if (letters.length < 4) return false;
    const vowels = letters.match(/[AEIOUÄÖÜaeiouäöü]/g)?.length ?? 0;
    return vowels / letters.length < 0.18;
  });

  return suspiciousWords.length / words.length > 0.35;
}
