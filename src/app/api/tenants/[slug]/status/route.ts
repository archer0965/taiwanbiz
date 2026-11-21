import { resolveStorefrontPreset } from "@/lib/storefront-preset";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import {
  daysUntilExpiry,
  isTenantBookingSuspended,
  isTenantOnTrial,
  resolveSubscriptionLifecycleStatus,
  toSubscriptionRow,
  toTenantDbRow,
} from "@/lib/tenants";
import { NextResponse } from "next/server";

type Props = {
  params: Promise<{ slug: string }>;
};

/** 前台 Page Guard 用：查詢訂閱狀態 */
export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const tenant = await getTenantDbByStoreId(slug);
  if (!tenant) {
    const storefrontPreset = resolveStorefrontPreset({ slug });
    return NextResponse.json({
      ok: true,
      found: false,
      status: "Active",
      suspended: false,
      storefrontPreset,
      subscription: {
        store_id: slug,
        expires_at: "",
        status: "active",
      },
    });
  }

  const onTrial = isTenantOnTrial(tenant);
  const suspended = isTenantBookingSuspended(tenant);
  const subscription = toSubscriptionRow(tenant);
  const storefrontPreset = resolveStorefrontPreset({
    slug,
    planName: tenant.planName,
    listAmount: tenant.listAmount,
  });

  return NextResponse.json({
    ok: true,
    found: true,
    status: tenant.status,
    /** 銀行轉帳審核中＝pending_review */
    reviewStatus:
      tenant.status === "Pending" ? "pending_review" : subscription.status,
    suspended,
    name: tenant.name,
    ownerEmail: tenant.ownerEmail,
    planName: tenant.planName,
    isFoundingMember: Boolean(tenant.isFoundingMember),
    planType: tenant.planType,
    listAmount: tenant.listAmount,
    storefrontPreset,
    schema: toTenantDbRow(tenant),
    /** subscriptions 表格對應：expires_at + status(active|expired|trial) */
    subscription,
    subscriptionStatus: resolveSubscriptionLifecycleStatus(tenant),
    expiresAt: tenant.expiresAt,
    daysUntilExpiry: daysUntilExpiry(tenant),
    nextBillingDate: tenant.nextBillingDate,
    gracePeriodEndsAt: tenant.gracePeriodEndsAt,
    onTrial,
    trialEndsAt: tenant.trialEndsAt,
    trialStartedAt: tenant.trialStartedAt,
    lastPaymentAt: tenant.lastPaymentAt,
    cancelledAt: tenant.cancelledAt,
    billingCreditBalance: Number(tenant.billingCreditBalance) || 0,
    referralCodeUsed: tenant.referralCodeUsed,
    referralDiscountApplied: Number(tenant.referralDiscountApplied) || 0,
    renewUrl: `/dashboard/billing`,
  });
}
