"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ARCHITECTURE } from "@/lib/architecture-constraints";
import { redirectToEcpay } from "@/lib/checkout-client";
import {
  enabledBillingPayments,
  type BillingPaymentId,
} from "@/lib/ecpay-payments";
import {
  annualPrice,
  applyFoundingDiscount,
  formatTwd,
  type PricingBillingCycle,
} from "@/lib/pricing";
import {
  applyBillingCredit,
  REFERRAL_CREDIT_PER_CYCLE_CAP,
} from "@/lib/referral";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const PAY_LABELS: Record<BillingPaymentId, string> = {
  credit: "信用卡一次付清",
  atm: "ATM 虛擬帳號",
  cvs: "超商代碼繳費",
  period: "信用卡定期定額（每月自動・需綠界加開）",
};

type Props = {
  storeId: string;
  planId?: "starter" | "growth";
  monthlyListAmount?: number;
  isFoundingMember?: boolean;
  billingCreditBalance?: number;
  defaultCycle?: PricingBillingCycle;
  renewalToken?: string | null;
  onSuccess?: (message: string) => void;
};

export function EcpaySubscriptionPayForm({
  storeId,
  planId: initialPlanId,
  monthlyListAmount,
  isFoundingMember = false,
  billingCreditBalance = 0,
  defaultCycle = "monthly",
  renewalToken,
  onSuccess,
}: Props) {
  const payments = enabledBillingPayments();
  const inferredPlan: "starter" | "growth" =
    initialPlanId ||
    (monthlyListAmount === ARCHITECTURE.plans.starter.monthly ||
    monthlyListAmount === ARCHITECTURE.plans.starter.annual
      ? "starter"
      : "growth");

  const [selectedPlan, setSelectedPlan] = useState<"starter" | "growth">(
    inferredPlan,
  );
  const [billingCycle, setBillingCycle] =
    useState<PricingBillingCycle>(defaultCycle);
  const [paymentType, setPaymentType] = useState<BillingPaymentId>(() => {
    // 預設信用卡一次付清（基本金流）；定期定額需特店加開
    if (payments.includes("credit")) return "credit";
    if (payments.includes("atm")) return "atm";
    if (payments.includes("cvs")) return "cvs";
    if (payments.includes("period")) return "period";
    return payments[0] || "credit";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const monthly =
    selectedPlan === "starter"
      ? ARCHITECTURE.plans.starter.monthly
      : ARCHITECTURE.plans.flagship.monthly;
  const listAmount =
    billingCycle === "annual" ? annualPrice(monthly) : monthly;
  const afterFounding = applyFoundingDiscount(listAmount, isFoundingMember);
  const credited = applyBillingCredit(afterFounding, billingCreditBalance);
  const payAmount = Math.max(1, credited.payAmount);

  const availablePayments = useMemo(() => {
    // 年繳不提供定期定額
    if (billingCycle === "annual") {
      return payments.filter((p) => p !== "period");
    }
    return payments;
  }, [billingCycle, payments]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!availablePayments.length) {
      setError("目前尚未開放綠界訂閱付款方式，請稍後再試或聯絡拓脈。");
      return;
    }
    const pay = availablePayments.includes(paymentType)
      ? paymentType
      : availablePayments[0];
    setBusy(true);
    try {
      const res = await fetch("/api/billing/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          planId: selectedPlan,
          billingCycle,
          paymentType: pay,
          amount: payAmount,
          token: renewalToken || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        mode?: string;
        action?: string;
        params?: Record<string, string>;
        redirectUrl?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "建立付款失敗");

      if (data.mode === "live" && data.action && data.params) {
        redirectToEcpay(data.action, data.params);
        return;
      }

      const msg = data.message || "已完成訂閱付款（示範模式）";
      onSuccess?.(msg);
      if (data.redirectUrl) {
        window.setTimeout(() => {
          window.location.href = data.redirectUrl!;
        }, 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "付款失敗");
    } finally {
      setBusy(false);
    }
  }

  if (!payments.length) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        綠界訂閱付款尚未開放（請設定 NEXT_PUBLIC_ECPAY_BILLING_PAYMENTS）。
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedPlan("starter")}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-left text-sm transition",
            selectedPlan === "starter"
              ? "border-teal-500 bg-teal-50 text-teal-950"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
          )}
        >
          <span className="block font-semibold">極速預約基礎版</span>
          <span className="text-xs opacity-80">
            {formatTwd(ARCHITECTURE.plans.starter.monthly)}／月
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedPlan("growth")}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-left text-sm transition",
            selectedPlan === "growth"
              ? "border-teal-500 bg-teal-50 text-teal-950"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
          )}
        >
          <span className="block font-semibold">品牌導流旗艦版</span>
          <span className="text-xs opacity-80">
            {formatTwd(ARCHITECTURE.plans.flagship.monthly)}／月
          </span>
        </button>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["monthly", "月繳"],
            ["annual", "年繳（省 2 個月）"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setBillingCycle(id);
              if (id === "annual" && paymentType === "period") {
                setPaymentType(
                  availablePayments.find((p) => p !== "period") || "credit",
                );
              }
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              billingCycle === id
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <Label className="text-xs text-stone-500">綠界付款方式</Label>
        <div className="mt-1.5 grid gap-2">
          {availablePayments.map((id) => (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                paymentType === id
                  ? "border-teal-500 bg-teal-50"
                  : "border-stone-200 bg-white",
              )}
            >
              <input
                type="radio"
                name="ecpay-pay"
                checked={paymentType === id}
                onChange={() => setPaymentType(id)}
                className="accent-teal-700"
              />
              {PAY_LABELS[id]}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
        <div className="flex justify-between gap-3">
          <span>方案原價</span>
          <span>{formatTwd(listAmount)}</span>
        </div>
        {isFoundingMember ? (
          <div className="mt-1 flex justify-between gap-3 text-amber-800">
            <span>創始 8 折</span>
            <span>−{formatTwd(listAmount - afterFounding)}</span>
          </div>
        ) : null}
        {credited.creditUsed > 0 ? (
          <div className="mt-1 flex justify-between gap-3 text-rose-800">
            <span>
              推薦點數扣抵（上限 {formatTwd(REFERRAL_CREDIT_PER_CYCLE_CAP)}）
            </span>
            <span>−{formatTwd(credited.creditUsed)}</span>
          </div>
        ) : null}
        <div className="mt-2 flex justify-between gap-3 border-t border-stone-200 pt-2 font-semibold text-stone-900">
          <span>綠界應付</span>
          <span>{formatTwd(payAmount)}</span>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "導向綠界中…" : `前往綠界付款 ${formatTwd(payAmount)}`}
      </Button>
      <p className="text-[11px] leading-relaxed text-stone-500">
        付款完成後綠界會回傳結果並自動開通／展延訂閱。定期定額成功後將依月自動扣款；年繳請選一次付清。
      </p>
    </form>
  );
}
