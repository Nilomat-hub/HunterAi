import { prisma } from "@/lib/db/prisma";

export async function canSendApplication(userId: string) {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  const maxPerHour = settings?.maxPerHour ?? 10;
  const maxPerDay = settings?.maxPerDay ?? 50;
  const now = Date.now();

  const [hourCount, dayCount] = await Promise.all([
    prisma.application.count({
      where: {
        userId,
        status: "SENT",
        sentAt: { gte: new Date(now - 60 * 60 * 1000) }
      }
    }),
    prisma.application.count({
      where: {
        userId,
        status: "SENT",
        sentAt: { gte: new Date(now - 24 * 60 * 60 * 1000) }
      }
    })
  ]);

  return {
    allowed: hourCount < maxPerHour && dayCount < maxPerDay,
    hourCount,
    dayCount,
    maxPerHour,
    maxPerDay
  };
}
