import { auth } from "@/auth";
import {
  listBankTransferReports,
  updateBankTransferReport,
} from "@/lib/bank-transfer-db.server";
import { ECPAY_BILLING_MESSAGE } from "@/lib/architecture-constraints";
import { grantReferralOnFirstPayment } from "@/lib/referral-db.server";
import { isDeveloperEmail } from "@/lib/roles";
import {
  getTenantDbByStoreId,
  patchTenantDb,
} from "@/lib/tenant-db.server";
import { billingDatesAfterSuccess } from "@/lib/tenants";
import { NextResponse } from "next/server";

export const instant = false;

/**
 * 訂閱匯款回報已停用：一律改走綠界。
 * Admin GET／PATCH 仍保留，僅供清掉歷史 pending 匯款單。
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const storeId = String(body.storeId || "")
    .trim()
    .toLowerCase()
    .slice(0, 48);
  return NextResponse.json(
    {
      ok: false,
      error: ECPAY_BILLING_MESSAGE,
      code: "SUBSCRIPTION_ECPAY_ONLY",
      redirectUrl: storeId
        ? `/billing/renew?storeId=${encodeURIComponent(storeId)}`
        : "/dashboard/billing",
    },
    { status: 410 },
  );
}

/** 管理員：列出／審核歷史轉帳回報（新單已停收） */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!isDeveloperEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    deprecated: true,
    message: ECPAY_BILLING_MESSAGE,
    pending: listBankTransferReports("pending_review"),
    approved: listBankTransferReports("approved").slice(0, 20),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!isDeveloperEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  const action = String(body.action || "").trim();
  if (!id) {
    return NextResponse.json({ error: "缺少回報編號" }, { status: 400 });
  }

  if (action === "reject") {
    const updated = updateBankTransferReport(id, {
      status: "rejected",
      reviewedAt: new Date().toISOString(),
      reviewerEmail: email,
    });
    if (!updated) {
      return NextResponse.json({ error: "找不到回報" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, report: updated });
  }

  if (action !== "approve") {
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }

  const report = listBankTransferReports().find((r) => r.id === id);
  if (!report) {
    return NextResponse.json({ error: "找不到回報" }, { status: 404 });
  }

  const days = report.billingCycle === "annual" ? 365 : 30;
  const dates = billingDatesAfterSuccess(new Date(), days);
  const existingTenant = await getTenantDbByStoreId(report.storeId);
  const patched = await patchTenantDb(report.storeId, {
    status: "Active",
    expiresAt: dates.expiresAt,
    nextBillingDate: dates.nextBillingDate,
    lastPaymentAt: new Date().toISOString(),
    pendingPaymentCode: null,
    pendingPaymentLabel: null,
    pendingTradeNo: null,
    pendingPaymentExpireAt: null,
    gracePeriodEndsAt: null,
    planName: report.planName,
    listAmount:
      existingTenant?.listAmount && existingTenant.listAmount > 0
        ? existingTenant.listAmount
        : report.amount,
    referralCodeUsed:
      report.referralCode || existingTenant?.referralCodeUsed || null,
    expiryReminderForExpiresAt: null,
    expiryReminderD1ForExpiresAt: null,
    expiryReminderSentAt: null,
  });

  const referralGrant = await grantReferralOnFirstPayment(report.storeId);

  if (report.creditApplied && report.creditApplied > 0) {
    const current = await getTenantDbByStoreId(report.storeId);
    const bal = Number(current?.billingCreditBalance) || 0;
    await patchTenantDb(report.storeId, {
      billingCreditBalance: Math.max(0, bal - report.creditApplied),
    });
  }

  const updated = updateBankTransferReport(id, {
    status: "approved",
    reviewedAt: new Date().toISOString(),
    reviewerEmail: email,
  });

  const referralNote = referralGrant.ok
    ? `；推薦獎勵已發送（推薦人下期折抵 NT$ ${referralGrant.referrerCredit}）`
    : "";

  return NextResponse.json({
    ok: true,
    report: updated,
    tenant: patched,
    referral: referralGrant.ok ? referralGrant : null,
    message: `已開通 ${report.storeName}，展延 ${days} 天${referralNote}`,
  });
}
