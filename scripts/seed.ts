import bcrypt from "bcryptjs";
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
  const password = process.env.INITIAL_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("INITIAL_USER_EMAIL and INITIAL_USER_PASSWORD are required for seeding.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      ...defaultProfile,
      settings: { create: {} }
    },
    update: {
      passwordHash,
      ...defaultProfile
    }
  });

  await prisma.settings.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  });

  console.log(`Seeded single user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
