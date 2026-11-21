"use client";

import { EcpaySubscriptionPayForm } from "@/components/billing/ecpay-subscription-pay-form";
import { BrandLogo } from "@/components/brand-logo";
import { ARCHITECTURE } from "@/lib/architecture-constraints";
import { formatSellerSubscriptionStatus } from "@/lib/tenants";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type TenantLite = {
  name?: string;
  storeId?: string;
  ownerEmail?: string;
  planName?: string | null;
  listAmount?: number | null;
  isFoundingMember?: boolean;
  status?: string;
  expiresAt?: string;
  trialEndsAt?: string | null;
  lastPaymentAt?: string | null;
  cancelledAt?: string | null;
  billingCreditBalance?: number;
  referralDiscountApplied?: number;
  renewalToken?: string | null;
};

export function BillingRenewClient() {
  const searchParams = useSearchParams();
  const storeId = (searchParams.get("storeId") || "").trim().toLowerCase();
  const [tenant, setTenant] = useState<TenantLite | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  useEffect(() => {
    if (!storeId) return;
    void fetch(`/api/tenants/${encodeURIComponent(storeId)}/status`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.found) return;
        setTenant({
          name: data.name,
          storeId,
          ownerEmail: data.ownerEmail,
          planName: data.planName,
          listAmount: data.listAmount,
          isFoundingMember: data.isFoundingMember,
          status: data.status,
          expiresAt: data.expiresAt,
          trialEndsAt: data.trialEndsAt,
          lastPaymentAt: data.lastPaymentAt,
          cancelledAt: data.cancelledAt,
          billingCreditBalance: Number(data.billingCreditBalance) || 0,
          referralDiscountApplied: Number(data.referralDiscountApplied) || 0,
          renewalToken: data.renewalToken || null,
        });
      })
      .catch(() => undefined);
  }, [storeId]);

  useEffect(() => {
    if (!storeId || tenant?.ownerEmail) return;
    void fetch("/api/stores/mine", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const hit = (data.tenants || []).find(
          (t: { storeId?: string }) => t.storeId === storeId,
        );
        if (!hit) return;
        setTenant((prev) => ({
          ...(prev || {}),
          storeId,
          name: hit.name || prev?.name,
          ownerEmail: hit.ownerEmail,
          planName: hit.planName || prev?.planName,
          listAmount: hit.listAmount ?? prev?.listAmount,
          isFoundingMember: hit.isFoundingMember ?? prev?.isFoundingMember,
          status: hit.status || prev?.status,
          expiresAt: hit.expiresAt || prev?.expiresAt,
          trialEndsAt: hit.trialEndsAt ?? prev?.trialEndsAt,
          lastPaymentAt: hit.lastPaymentAt ?? prev?.lastPaymentAt,
          cancelledAt: hit.cancelledAt ?? prev?.cancelledAt,
          billingCreditBalance:
            Number(hit.billingCreditBalance) ||
            prev?.billingCreditBalance ||
            0,
          referralDiscountApplied:
            Number(hit.referralDiscountApplied) ||
            prev?.referralDiscountApplied ||
            0,
          renewalToken: hit.renewalToken ?? prev?.renewalToken ?? null,
        }));
      })
      .catch(() => undefined);
  }, [storeId, tenant?.ownerEmail]);

  const statusLabel = tenant
    ? formatSellerSubscriptionStatus({
        id: `t-${storeId}`,
        storeId,
        name: tenant.name || storeId,
        slug: storeId,
        planType: "self-serve",
        status:
          (tenant.status as "Active" | "Pending" | "Suspended") || "Pending",
        expiresAt: tenant.expiresAt || "",
        nextBillingDate: null,
        gracePeriodEndsAt: null,
        merchantMemberId: null,
        cardToken: null,
        lastPaymentAt: tenant.lastPaymentAt || null,
        pageViews: 0,
        ownerEmail: tenant.ownerEmail || "",
        createdAt: new Date().toISOString(),
        isFoundingMember: Boolean(tenant.isFoundingMember),
        billingMethod: "credit",
        planName: tenant.planName || null,
        listAmount: tenant.listAmount ?? null,
        pendingPaymentCode: null,
        pendingPaymentLabel: null,
        pendingTradeNo: null,
        pendingPaymentExpireAt: null,
        renewalToken: tenant.renewalToken || null,
        periodTradeNo: null,
        cancelledAt: tenant.cancelledAt || null,
        cancelReason: null,
        trialStartedAt: null,
        trialEndsAt: tenant.trialEndsAt || null,
        billingCreditBalance: Number(tenant.billingCreditBalance) || 0,
        referralCodeUsed: null,
        referralDiscountApplied: Number(tenant.referralDiscountApplied) || 0,
        expiryReminderForExpiresAt: null,
        expiryReminderD1ForExpiresAt: null,
        expiryReminderSentAt: null,
      })
    : "";

  const planId: "starter" | "growth" =
    (tenant?.listAmount || 0) === ARCHITECTURE.plans.starter.monthly ||
    (tenant?.listAmount || 0) === ARCHITECTURE.plans.starter.annual
      ? "starter"
      : "growth";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4 py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">
              ECPay
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              續訂／升級・綠界付款
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          訂閱已改為綠界線上付款。選擇方案與付款方式後，將導向綠界完成信用卡、定期定額、ATM
          或超商代碼繳費；付款成功即自動開通／展延。
        </p>

        {storeId ? (
          <dl className="mt-4 space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">店家代號</dt>
              <dd className="font-mono text-slate-800">{storeId}</dd>
            </div>
            {tenant?.name ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">店家</dt>
                <dd className="font-medium text-slate-800">{tenant.name}</dd>
              </div>
            ) : null}
            {statusLabel ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">目前狀態</dt>
                <dd className="font-medium text-slate-800">{statusLabel}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">請從訂閱後台進入續費</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
              此頁需要店家代號才能建立綠界訂單。請登入後台「訂閱付款」，或從定價頁完成試用／訂閱。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/login"
                className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-800"
              >
                登入後台
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
              >
                查看方案
              </Link>
            </div>
          </div>
        )}

        {doneMessage ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {doneMessage}
          </p>
        ) : null}

        {storeId && tenant?.ownerEmail ? (
          <div className="mt-5">
            <EcpaySubscriptionPayForm
              storeId={storeId}
              planId={planId}
              monthlyListAmount={
                tenant.listAmount && tenant.listAmount > 0
                  ? tenant.listAmount
                  : 499
              }
              isFoundingMember={Boolean(tenant.isFoundingMember)}
              billingCreditBalance={Number(tenant.billingCreditBalance) || 0}
              renewalToken={tenant.renewalToken}
              onSuccess={setDoneMessage}
            />
          </div>
        ) : storeId ? (
          <p className="mt-4 text-sm text-amber-800">
            請先{" "}
            <Link href="/login" className="underline">
              登入店主帳號
            </Link>{" "}
            後再付款，或前往{" "}
            <Link href="/pricing" className="underline">
              定價頁
            </Link>{" "}
            重新訂閱。
          </p>
        ) : null}

        <Link
          href="/dashboard/billing"
          className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-800"
        >
          返回訂閱與付款
        </Link>
      </div>
    </div>
  );
}
