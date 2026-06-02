import { Portal } from "@prisma/client";
import { generateApplicationMessage } from "../lib/ai/applications";
import { prisma } from "../lib/db/prisma";

const defaultProfile = {
  age: 19,
  occupation: "dualer Student",
  dualStudyProgram: "Wirtschaftsinformatik",
  employer: "PIA Media",
  monthlyAvailableBudget: 1500,
  guarantorAvailable: true,
  currentHousingSituation:
    "Momentan wohne ich noch außerhalb von Hamburg und habe dadurch einen langen Weg.",
  moveReason:
    "Aufgrund der mittelmäßigen ÖPNV-Anbindung möchte ich gerne näher in die Stadt ziehen.",
  locationBenefit: "dass ich von dort aus sehr schnell an meinen Arbeitsplatz und zur Uni komme"
};

async function main() {
  const email = process.env.INITIAL_USER_EMAIL;

  if (!email) {
    throw new Error("INITIAL_USER_EMAIL is required.");
  }

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error("Seed user not found. Run npm run db:seed first.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...defaultProfile,
      contactEmail: user.contactEmail ?? user.email,
      salutation: user.salutation ?? "Herr"
    }
  });

  const profile = await prisma.searchProfile.upsert({
    where: { id: "demo-search-profile" },
    create: {
      id: "demo-search-profile",
      userId: user.id,
      name: "Demo: Berlin Wohnung",
      city: "Berlin",
      districts: ["Prenzlauer Berg", "Friedrichshain", "Kreuzberg"],
      maxPrice: 1500,
      minSize: 55,
      rooms: 2,
      petsAllowed: false,
      keywords: ["Balkon", "hell", "ruhig"],
      excludedWords: ["Tauschwohnung"]
    },
    update: {}
  });

  const listing = await prisma.listing.upsert({
    where: {
      userId_normalizedUrl: {
        userId: user.id,
        normalizedUrl: "https://example.com/demo-listing"
      }
    },
    create: {
      userId: user.id,
      searchProfileId: profile.id,
      portal: Portal.IMMOSCOUT24,
      url: "https://example.com/demo-listing",
      normalizedUrl: "https://example.com/demo-listing",
      title: "Helle 2-Zimmer-Wohnung mit Balkon",
      price: 1380,
      size: 62,
      rooms: 2,
      address: "Prenzlauer Berg, Berlin",
      district: "Prenzlauer Berg",
      provider: "Demo Hausverwaltung",
      images: [],
      description:
        "Eine helle und gut geschnittene Wohnung mit Balkon, ruhiger Lage und schneller Anbindung.",
      score: 91,
      scoreLabel: "Perfekter Treffer",
      status: "NOTIFIED",
      contactMethod: "FORM"
    },
    update: {
      status: "NOTIFIED"
    }
  });

  const message = await generateApplicationMessage(updatedUser, listing);

  await prisma.application.upsert({
    where: { id: "demo-application" },
    create: {
      id: "demo-application",
      userId: user.id,
      listingId: listing.id,
      status: "PENDING_APPROVAL",
      message
    },
    update: {
      status: "PENDING_APPROVAL",
      message,
      editedMessage: null,
      sentAt: null,
      errorMessage: null
    }
  });

  console.log("Demo data seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
