import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runScheduledScan } from "@/lib/listings/pipeline";

export const maxDuration = 300;

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET ?? process.env.SCHEDULER_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return Boolean(expected && actual === expected);
}

async function runScheduler(request: Request) {
  if (!isAuthorized(request)) {
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

export async function GET(request: Request) {
  return runScheduler(request);
}

export async function POST(request: Request) {
  return runScheduler(request);
}
