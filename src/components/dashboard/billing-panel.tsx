"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { EcpaySubscriptionPayForm } from "@/components/billing/ecpay-subscription-pay-form";
import { SellerNotificationsPanel } from "@/components/dashboard/seller-notifications-panel";
import { ARCHITECTURE } from "@/lib/architecture-constraints";
import { applyFoundingDiscount, formatTwd } from "@/lib/pricing";
import {
  REFERRAL_COPY,
  REFERRAL_CREDIT_PER_CYCLE_CAP,
  REFERRAL_NEW_STORE_DISCOUNT,
  applyBillingCredit,
  referralCodeFromStoreId,
} from "@/lib/referral";
import { isDeveloperEmail } from "@/lib/roles";
import {
  daysUntilExpiry,
  formatSellerSubscriptionStatus,
  isTenantBookingSuspended,
  isTenantOnTrial,
  PLAN_TYPE_LABELS,
  resolveSubscriptionLifecycleStatus,
  type TenantBillingMethod,
  type TenantRecord,
} from "@/lib/tenants";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const BILLING_LABELS: Record<TenantBillingMethod, string> = {
  period: "綠界・信用卡定期定額",
  credit: "綠界・信用卡一次付清",
  atm: "綠界・ATM 虛擬帳號",
  cvs: "綠界・超商代碼",
  bank_transfer: "銀行轉帳（舊）",
};

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

export function BillingPanel() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const isAdmin = isDeveloperEmail(email);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const closeToast = useCallback(() => setToastOpen(false), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stores/mine", { cache: "no-store" });
      const data = (await res.json()) as { tenants?: TenantRecord[] };
      setTenants(data.tenants || []);
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!email) {
      setTenants([]);
      setLoading(false);
      return;
    }
    void load();
  }, [email, load]);

  async function cancelStore(storeId: string) {
    setBusyId(storeId);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        tenant?: TenantRecord;
      };
      if (!res.ok) throw new Error(data.error || "解約失敗");
      setToastMsg(data.message || "已送出解約");
      setToastOpen(true);
      setConfirmId(null);
      setReason("");
      await load();
    } catch (error) {
      setToastMsg(error instanceof Error ? error.message : "解約失敗");
      setToastOpen(true);
    } finally {
      setBusyId(null);
    }
  }

  if (!email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>訂閱與付款</CardTitle>
          <CardDescription>請先登入店主 Email 後管理訂閱</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button as="span">前往登入</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          訂閱與付款
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          以綠界線上付款續訂或升級；逾期未續費前台將暫停預約。
        </p>
      </div>

      <SellerNotificationsPanel />

      {loading ? (
        <p className="text-sm text-slate-500">載入訂閱資料中…</p>
      ) : tenants.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            {isAdmin
              ? "總管請至總管理後台操作各店解約。"
              : "此 Email 尚未綁定店家訂閱。"}
            {isAdmin ? (
              <div className="mt-3">
                <Link href="/admin/dashboard">
                  <Button as="span" variant="outline">
                    打開總管理後台
                  </Button>
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        tenants.map((tenant) => {
          const cancelled = Boolean(tenant.cancelledAt);
          const confirming = confirmId === tenant.storeId;
          const onTrial = isTenantOnTrial(tenant);
          const bookingPaused = isTenantBookingSuspended(tenant);
          const life = resolveSubscriptionLifecycleStatus(tenant);
          const daysLeft = daysUntilExpiry(tenant);
          const listAmount =
            tenant.listAmount && tenant.listAmount > 0
              ? tenant.listAmount
              : ARCHITECTURE.plans.flagship.monthly;
          const afterFounding = applyFoundingDiscount(
            listAmount,
            tenant.isFoundingMember,
          );
          const creditBalance = Number(tenant.billingCreditBalance) || 0;
          const credited = applyBillingCredit(afterFounding, creditBalance);
          const payAmount = credited.payAmount;
          const myReferralCode = referralCodeFromStoreId(tenant.storeId);
          const needsPaid =
            onTrial ||
            (Boolean(tenant.trialEndsAt) &&
              !tenant.lastPaymentAt &&
              tenant.status !== "Suspended");
          return (
            <Card key={tenant.id}>
              <CardHeader>
                <CardTitle>{tenant.name}</CardTitle>
                <CardDescription>
                  /stores/{tenant.slug}・
                  {PLAN_TYPE_LABELS[tenant.planType]}・
                  {formatSellerSubscriptionStatus(tenant)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-700">
                <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-xs font-semibold tracking-wide text-stone-500">
                    目前方案狀態
                  </p>
                  <p className="mt-1 font-semibold text-stone-900">
                    {formatSellerSubscriptionStatus(tenant)}
                  </p>
                  {tenant.status === "Pending" ? (
                    <p className="mt-1 text-xs text-amber-800">
                      Pending：請以綠界完成線上付款；付款成功後即自動開通。
                    </p>
                  ) : null}
                </div>
                {bookingPaused ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-950">
                    <p className="font-medium">
                      系統維護／方案已到期暫停預約
                    </p>
                    <p className="mt-1 text-xs text-rose-900/80">
                      subscriptions.status = {life}・expires_at ={" "}
                      {tenant.expiresAt || "—"}
                      。完成綠界線上付款後即可恢復前台接單。
                    </p>
                  </div>
                ) : typeof daysLeft === "number" &&
                  daysLeft >= 0 &&
                  daysLeft <= 3 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                    <p className="font-medium">
                      方案將於 {daysLeft} 天內到期（{tenant.expiresAt}）
                    </p>
                    <p className="mt-1 text-xs text-amber-900/80">
                      創始試用／正式訂閱：到期前 3 天與前 1 天提醒；一般 3 天試用僅於剩餘 1 天提醒。若已續費則略過。忘記續費可保留網站 30 天，其後才暫停。
                    </p>
                  </div>
                ) : null}
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">訂閱生命週期</dt>
                    <dd className="font-medium font-mono text-xs sm:text-sm">
                      {life}・expires_at {tenant.expiresAt || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">付款方式</dt>
                    <dd className="font-medium">
                      {BILLING_LABELS[tenant.billingMethod] ||
                        tenant.billingMethod}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {onTrial ? "試用截止" : "下次帳單／到期"}
                    </dt>
                    <dd className="font-medium">
                      {formatWhen(
                        onTrial
                          ? tenant.trialEndsAt
                          : tenant.nextBillingDate ||
                              (tenant.expiresAt
                                ? `${tenant.expiresAt}T00:00:00.000Z`
                                : null),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">創始會員</dt>
                    <dd className="font-medium">
                      {tenant.isFoundingMember
                        ? "是（14 天試用後續費終身 8 折）"
                        : "否"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">解約狀態</dt>
                    <dd className="font-medium">
                      {cancelled
                        ? `已解約（${formatWhen(tenant.cancelledAt)}）`
                        : onTrial
                          ? "試用中（尚未扣款）"
                          : "訂閱中"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">下期應付（預估）</dt>
                    <dd className="font-medium">
                      {formatTwd(payAmount)}
                      {credited.creditUsed > 0
                        ? `（已扣折抵 ${formatTwd(credited.creditUsed)}）`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">扣抵點數餘額</dt>
                    <dd className="font-medium">
                      {formatTwd(creditBalance)}
                      {creditBalance > 0
                        ? `（本期最多扣 ${formatTwd(Math.min(creditBalance, REFERRAL_CREDIT_PER_CYCLE_CAP))}）`
                        : ""}
                    </dd>
                  </div>
                </dl>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold tracking-wide text-stone-500">
                      極速預約基礎版
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-stone-900">
                      ${ARCHITECTURE.plans.starter.monthly}
                      <span className="text-sm font-medium text-stone-400">
                        /月
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      年繳 $
                      {ARCHITECTURE.plans.starter.annual.toLocaleString("en-US")}
                      （主站年繳 NT$3,588）
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-700">
                      推薦碼首月現折後約 $
                      {ARCHITECTURE.plans.starter.monthly -
                        REFERRAL_NEW_STORE_DISCOUNT}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-gradient-to-b from-rose-50 to-white px-4 py-3">
                    <p className="text-xs font-semibold tracking-wide text-rose-700">
                      品牌導流旗艦版
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-rose-800 px-2 py-0.5 text-[11px] font-bold text-white">
                      🔥 創始限定特惠價
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-rose-950">
                      ${ARCHITECTURE.plans.flagship.monthly}
                      <span className="text-sm font-medium text-rose-400">
                        /月
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-rose-800/80">
                      年繳 $
                      {ARCHITECTURE.plans.flagship.annual.toLocaleString(
                        "en-US",
                      )}
                      （主站年繳 NT$5,988）
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-700">
                      推薦碼首月現折後約 $
                      {ARCHITECTURE.plans.flagship.monthly -
                        REFERRAL_NEW_STORE_DISCOUNT}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-rose-950">
                  <p className="text-xs font-semibold tracking-wide text-rose-700">
                    {REFERRAL_COPY.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      您的推薦碼：{" "}
                      <span className="font-mono tracking-wide">
                        {myReferralCode || "—"}
                      </span>
                    </p>
                    {myReferralCode ? (
                      <button
                        type="button"
                        className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(myReferralCode);
                            setToastMsg(`已複製推薦碼 ${myReferralCode}`);
                            setToastOpen(true);
                          } catch {
                            setToastMsg("無法複製，請手動選取推薦碼");
                            setToastOpen(true);
                          }
                        }}
                      >
                        複製
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-rose-900/80">
                    {REFERRAL_COPY.referrerBenefit}
                    {REFERRAL_COPY.triggerNote}
                  </p>
                  {creditBalance > 0 ? (
                    <p className="mt-1 text-xs font-medium text-rose-900">
                      目前扣抵點數餘額：{formatTwd(creditBalance)}
                      （每期訂閱最多自動扣抵{" "}
                      {formatTwd(REFERRAL_CREDIT_PER_CYCLE_CAP)}）
                    </p>
                  ) : null}
                  {tenant.referralCodeUsed ? (
                    <p className="mt-1 text-xs text-rose-800/70">
                      開通時使用推薦碼：{tenant.referralCodeUsed}
                      {tenant.referralDiscountApplied > 0
                        ? `（首月已現折 ${formatTwd(tenant.referralDiscountApplied)}）`
                        : ""}
                    </p>
                  ) : null}
                </div>

                {needsPaid && !cancelled ? (
                  <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-teal-950">
                    <p className="font-medium">
                      {onTrial
                        ? "您正在免費試用，可透過綠界轉為正式訂閱。"
                        : "試用已結束，請完成綠界付款以免服務暫停。"}
                    </p>
                    <p className="mt-1 text-xs text-teal-900/80">
                      正式訂閱應付約 {formatTwd(payAmount)}
                      {tenant.isFoundingMember ? "（創始 8 折）" : ""}
                      。支援信用卡、定期定額、ATM、超商代碼。
                    </p>
                    <div className="mt-3 rounded-xl border border-teal-100 bg-white p-3">
                      <EcpaySubscriptionPayForm
                        storeId={tenant.storeId}
                        planId={
                          (tenant.listAmount || 0) ===
                          ARCHITECTURE.plans.starter.monthly
                            ? "starter"
                            : "growth"
                        }
                        monthlyListAmount={listAmount}
                        isFoundingMember={tenant.isFoundingMember}
                        billingCreditBalance={creditBalance}
                        renewalToken={tenant.renewalToken}
                        onSuccess={(msg) => {
                          setToastMsg(msg);
                          setToastOpen(true);
                          void load();
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {!needsPaid && !cancelled && !bookingPaused ? (
                  <div className="rounded-xl border border-stone-200 bg-white p-4">
                    <p className="text-sm font-semibold text-stone-900">
                      方案切換與續費（綠界）
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      選擇方案與月繳／年繳後，前往綠界完成付款即可展延到期日（創始
                      8 折與推薦點數會自動折抵，每期最多{" "}
                      {formatTwd(REFERRAL_CREDIT_PER_CYCLE_CAP)}）。
                    </p>
                    <div className="mt-3">
                      <EcpaySubscriptionPayForm
                        storeId={tenant.storeId}
                        planId={
                          (tenant.listAmount || 0) ===
                          ARCHITECTURE.plans.starter.monthly
                            ? "starter"
                            : "growth"
                        }
                        monthlyListAmount={listAmount}
                        isFoundingMember={tenant.isFoundingMember}
                        billingCreditBalance={creditBalance}
                        renewalToken={tenant.renewalToken}
                        onSuccess={(msg) => {
                          setToastMsg(msg);
                          setToastOpen(true);
                          void load();
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {cancelled ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                    已停止後續自動扣款／續約碼。
                    {tenant.status !== "Suspended"
                      ? " 當期服務仍可使用至帳單日結束，之後系統會自動暫停前台與後台。"
                      : " 店家目前已暫停。"}
                    {tenant.cancelReason ? (
                      <p className="mt-1 text-xs">備註：{tenant.cancelReason}</p>
                    ) : null}
                    <p className="mt-2 text-xs">
                      若要重新開通，請至{" "}
                      <Link href="/#pricing" className="underline">
                        定價頁
                      </Link>{" "}
                      重新訂閱（需重新綁定付款）。
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {!confirming ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-slate-600">
                          取消後將停止後續續約提醒與展延；當期服務仍可用至帳單日結束。
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 border-rose-300 text-rose-700 hover:bg-rose-50"
                          onClick={() => setConfirmId(tenant.storeId)}
                        >
                          取消定期付款／解約
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="font-medium text-rose-800">
                          確認解約「{tenant.name}」？此操作會停止後續自動扣款，且定期定額無法直接恢復。
                        </p>
                        <label className="block text-xs text-slate-500">
                          備註（選填）
                          <input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={200}
                            placeholder="例如：暫時歇業"
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="bg-rose-600 hover:bg-rose-700"
                            disabled={busyId === tenant.storeId}
                            onClick={() => void cancelStore(tenant.storeId)}
                          >
                            {busyId === tenant.storeId
                              ? "處理中…"
                              : "確認解約"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busyId === tenant.storeId}
                            onClick={() => {
                              setConfirmId(null);
                              setReason("");
                            }}
                          >
                            返回
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <Toast open={toastOpen} onClose={closeToast} message={toastMsg} />
    </div>
  );
}
