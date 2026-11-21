import { rateLimit } from "@/lib/rate-limit";
import { recordSiteView } from "@/lib/site-analytics-db.server";
import { NextResponse } from "next/server";

function clientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`analytics-view:${ip}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: { path?: string } = {};
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = (await req.json()) as { path?: string };
    } else {
      const text = await req.text();
      body = text ? (JSON.parse(text) as { path?: string }) : {};
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await recordSiteView(body.path || "/");
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Invalid path" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, path: result.path });
}
