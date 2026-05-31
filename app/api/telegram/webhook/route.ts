import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat?: { id?: number } };
  };
};

export async function POST(request: Request) {
  const update = (await request.json()) as TelegramUpdate;
  const callback = update.callback_query;

  if (!callback?.data) {
    return NextResponse.json({ ok: true });
  }

  const [scope, action, listingId] = callback.data.split(":");
  if (scope !== "listing" || !listingId) {
    return NextResponse.json({ ok: true });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { applications: { orderBy: { createdAt: "desc" }, take: 1 } }
  });

  if (!listing) {
    await answerCallback(callback.id, "Inserat nicht gefunden.");
    return NextResponse.json({ ok: true });
  }

  if (action === "ignore") {
    await prisma.$transaction([
      prisma.listing.update({
        where: { id: listing.id },
        data: { status: "IGNORED" }
      }),
      prisma.application.updateMany({
        where: { listingId: listing.id },
        data: { status: "IGNORED" }
      }),
      prisma.telegramLog.create({
        data: {
          userId: listing.userId,
          type: "ACTION",
          message: "Inserat ueber Telegram ignoriert.",
          payload: { listingId: listing.id }
        }
      })
    ]);
    await answerCallback(callback.id, "Inserat ignoriert.");
  }

  if (action === "apply") {
    const application = listing.applications[0];

    if (!application) {
      await answerCallback(callback.id, "Fuer dieses Inserat gibt es noch keine Bewerbung.");
      return NextResponse.json({ ok: true });
    }

    await prisma.$transaction([
      prisma.application.update({
        where: { id: application.id },
        data: { status: "APPROVED" }
      }),
      prisma.telegramLog.create({
        data: {
          userId: listing.userId,
          type: "ACTION",
          message: "Bewerbung ueber Telegram freigegeben.",
          payload: { applicationId: application.id, listingId: listing.id }
        }
      })
    ]);
    await answerCallback(callback.id, "Bewerbung freigegeben.");
  }

  if (action === "view") {
    await answerCallback(callback.id, "Oeffne das Inserat im Dashboard oder ueber den Link in der Nachricht.");
  }

  return NextResponse.json({ ok: true });
}

async function answerCallback(callbackQueryId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text
    })
  }).catch(() => undefined);
}
