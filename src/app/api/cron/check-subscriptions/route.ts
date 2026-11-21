import { runMonthlyShopPayouts } from "@/lib/shop-orders-db.server";
import { runSubscriptionCron } from "@/lib/subscription-billing";
import { toTenantDbRow } from "@/lib/tenants";
import { NextResponse } from "next/server";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Production 必須設定 CRON_SECRET；未設定時僅本機可呼
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      return false;
    }
    const host = request.headers.get("host") || "";
    return host.includes("localhost") || host.startsWith("127.0.0.1");
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const query = new URL(request.url).searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}

/**
 * 每日排程：
 * - 創始試用／正式訂閱：到期前 3 天與前 1 天提醒；一般 3 天試用僅剩餘 1 天提醒
 * - 到期未續費 → Pending（保留網站 30 天）；寬限結束／解約期滿 → Suspended
 * - 每月撥款批次（15–20 日）
 * Vercel Cron：GET /api/cron/check-subscriptions（vercel.json 每日 01:00 UTC）
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = await runSubscriptionCron(now);
  // 每月 15–20 日嘗試建立上月撥款批次（可重複呼叫，已建立則略過）
  const day = now.getDate();
  const payouts =
    day >= 15 && day <= 20
      ? await runMonthlyShopPayouts(now)
      : { periodLabel: null, createdCount: 0, batches: [] };

  return NextResponse.json({
    ok: true,
    ...result,
    payouts,
    suspended: result.suspended.map((tenant) => ({
      ...tenant,
      schema: toTenantDbRow(tenant),
    })),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
