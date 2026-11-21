import { auth } from "@/auth";
import { isDeveloperEmail } from "@/lib/roles";
import {
  listAdminPayoutLedger,
  markPayoutPaid,
  runMonthlyShopPayouts,
} from "@/lib/shop-orders-db.server";
import { NextResponse } from "next/server";

export const instant = false;

async function requireAdmin() {
  const session = await auth();
  if (!isDeveloperEmail(session?.user?.email)) return null;
  return session;
}

/** 總管：各店月收入／抽成／應撥款總表 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ledger = await listAdminPayoutLedger();
  const pendingTotal = ledger.reduce((s, r) => s + r.pendingNetAmount, 0);
  const commissionTotal = ledger.reduce((s, r) => s + r.lifetimeCommission, 0);
  return NextResponse.json({
    ok: true,
    pendingTotal,
    commissionTotal,
    storeCount: ledger.length,
    ledger,
  });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { action?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  if (body.action === "settle") {
    const result = await runMonthlyShopPayouts(new Date());
    return NextResponse.json({ ok: true, ...result });
  }
  return NextResponse.json({ error: "未知 action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { storeSlug?: string; payoutId?: string; action?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.action !== "mark-paid" || !body.storeSlug || !body.payoutId) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }
  const updated = await markPayoutPaid(body.storeSlug, body.payoutId);
  if (!updated) {
    return NextResponse.json({ error: "找不到撥款批次" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, payout: updated });
}
