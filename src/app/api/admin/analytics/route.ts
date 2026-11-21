import { auth } from "@/auth";
import { isDeveloperEmail } from "@/lib/roles";
import { getSiteAnalyticsSummary } from "@/lib/site-analytics-db.server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!isDeveloperEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getSiteAnalyticsSummary();
  return NextResponse.json({ ok: true, ...summary });
}
