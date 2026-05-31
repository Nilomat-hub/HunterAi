import { prisma } from "@/lib/db/prisma";

type Button = {
  text: string;
  callback_data: string;
};

export async function sendTelegramMessage(userId: string, text: string, buttons?: Button[][]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    await prisma.telegramLog.create({
      data: {
        userId,
        type: "ERROR",
        message: "Telegram ist nicht konfiguriert.",
        payload: { text }
      }
    });
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: buttons ? { inline_keyboard: buttons } : undefined
    })
  });

  const payload = await response.json().catch(() => ({}));

  await prisma.telegramLog.create({
    data: {
      userId,
      type: response.ok ? "LISTING_FOUND" : "ERROR",
      message: text,
      telegramId: payload?.result?.message_id ? String(payload.result.message_id) : undefined,
      payload
    }
  });
}

export function listingButtons(listingId: string) {
  return [
    [
      { text: "Anzeigen", callback_data: `listing:view:${listingId}` },
      { text: "Bewerben", callback_data: `listing:apply:${listingId}` },
      { text: "Ignorieren", callback_data: `listing:ignore:${listingId}` }
    ]
  ];
}
