import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runScheduledScan } from "@/lib/listings/pipeline";

export async function POST(request: Request) {
  const expected = process.env.SCHEDULER_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || actual !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: {
      settings: {
        is: {
          schedulerEnabled: true
        }
      }
    },
    select: { id: true }
  });

  const results = [];
  for (const user of users) {
    results.push(...(await runScheduledScan(user.id)));
  }

  return NextResponse.json({
    ok: true,
    processed: results.length
  });
}
