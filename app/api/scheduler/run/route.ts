import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runScheduledScan, type ScheduledScanSummary } from "@/lib/listings/pipeline";

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
    try {
      results.push(await runScheduledScan(user.id));
    } catch (error) {
      const message = safeErrorMessage(error);
      const summary: ScheduledScanSummary = {
        userId: user.id,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ userId: user.id, message }]
      };

      console.error("scheduler.user_failed", { userId: user.id, message });
      results.push(summary);
    }
  }

  return NextResponse.json({
    ok: results.every((result) => result.errors.length === 0),
    users: results.length,
    processed: sum(results, "processed"),
    created: sum(results, "created"),
    updated: sum(results, "updated"),
    skipped: sum(results, "skipped"),
    errors: results.flatMap((result) => result.errors)
  });
}

function sum(results: ScheduledScanSummary[], key: "processed" | "created" | "updated" | "skipped") {
  return results.reduce((total, result) => total + result[key], 0);
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/(token|secret|password|key)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}

export async function GET(request: Request) {
  return runScheduler(request);
}

export async function POST(request: Request) {
  return runScheduler(request);
}
