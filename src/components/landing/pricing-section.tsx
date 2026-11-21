"use client";

import {
  SubscribeCheckoutDialog,
  type SubscribeTarget,
} from "@/components/landing/subscribe-checkout-dialog";
import { Button } from "@/components/ui/button";
import {
  annualMonthlyEquivalent,
  annualPrice,
  applyFoundingDiscount,
  BOOKING_CORE_FEATURES,
  formatTwd,
  planSelectionLabel,
  PRICING_NOTE,
  pricingCategories,
  type PricingBillingCycle,
  type PricingCategory,
  type PricingPlan,
} from "@/lib/pricing";
import { REFERRAL_COPY } from "@/lib/referral";
import { cn } from "@/lib/utils";
import {
  CalendarCheck2,
  Check,
  MessageCircle,
  Sparkles,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

type Props = {
  showHeading?: boolean;
  className?: string;
};

const featureIcons = {
  booking: CalendarCheck2,
  scratch: Ticket,
  line: MessageCircle,
  vip: Users,
} as const;

export function PricingSection({ showHeading = true, className }: Props) {
  const baseId = useId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscribeTarget, setSubscribeTarget] = useState<SubscribeTarget | null>(
    null,
  );
  const [billingCycle, setBillingCycle] =
    useState<PricingBillingCycle>("monthly");
  const [billingToast, setBillingToast] = useState("");

  const activeCategory = pricingCategories[0];

  const selectPlanAndScroll = useCallback(
    (label: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("market");
      params.delete("type");
      params.set("plan", label);
      const query = params.toString();

      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        router.push(`/?${query}#contact`);
        return;
      }

      const next = `/?${query}#contact`;
      window.history.replaceState({}, "", next);
      window.dispatchEvent(
        new CustomEvent("taiwanbiz-select-plan", { detail: { plan: label } }),
      );
      document.getElementById("contact")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [router, searchParams],
  );

  function handleConsult(category: PricingCategory, plan: PricingPlan) {
    selectPlanAndScroll(planSelectionLabel(category, plan));
  }

  function handleSubscribe(
    category: PricingCategory,
    plan: PricingPlan,
    intent: "founding" | "trial" = "trial",
  ) {
    setSubscribeTarget({ category, plan, billingCycle, intent });
  }

  function openFoundingCheckout(preferredPlanId?: string) {
    const category = activeCategory;
    const plan =
      (preferredPlanId
        ? category.plans.find((p) => p.id === preferredPlanId)
        : undefined) ||
      category.plans.find((p) => p.recommended) ||
      category.plans[0];
    if (!plan) return;
    setSubscribeTarget({
      category,
      plan,
      billingCycle,
      intent: "founding",
    });
  }

  useEffect(() => {
    const billing = searchParams.get("billing");
    const storeId = searchParams.get("storeId");
    if (billing === "mock-success") {
      setBillingToast(
        storeId
          ? `示範付款成功：店家 ${storeId} 已啟用（Active）`
          : "示範付款成功，店家已啟用",
      );
    } else if (billing === "return") {
      setBillingToast(
        storeId
          ? `已返回定價頁。店家 ${storeId} 請至後台以綠界完成訂閱付款開通。`
          : "已返回定價頁。訂閱採綠界線上付款，請至後台完成付款開通。",
      );
    } else {
      return;
    }
    const timer = window.setTimeout(() => setBillingToast(""), 6000);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  // 主頁「免費申請創始店家」→ /?founding=1#pricing ：自動打開創始免付費結帳
  useEffect(() => {
    if (searchParams.get("founding") !== "1") return;
    openFoundingCheckout();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("founding");
    const query = params.toString();
    const next = query ? `/?${query}#pricing` : "/#pricing";
    window.history.replaceState({}, "", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on founding=1 entry
  }, [searchParams]);

  return (
    <section
      id="pricing"
      className={cn("relative overflow-hidden py-16 sm:py-20", className)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,113,108,0.08),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(28,25,23,0.05),transparent_40%)]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {showHeading && (
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-wide text-stone-600">
              方案價格對照
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              極速預約基礎版 × 品牌導流旗艦版
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
              {activeCategory.description}
            </p>
          </div>
        )}

        <div
          className={cn(
            "mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap",
            showHeading ? "mt-10" : "mt-2",
          )}
        >
          <div
            className="inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm"
            role="group"
            aria-label="月繳／年繳切換"
          >
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              aria-pressed={billingCycle === "monthly"}
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200",
                billingCycle === "monthly"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:bg-stone-50",
              )}
            >
              月繳
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              aria-pressed={billingCycle === "annual"}
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200",
                billingCycle === "annual"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:bg-stone-50",
              )}
            >
              年繳 (✨ 立省 2 個月)
            </button>
          </div>
          <span className="inline-flex items-center rounded-full border border-rose-300 bg-gradient-to-r from-rose-50 to-amber-50 px-3.5 py-1.5 text-xs font-bold tracking-wide text-rose-800 shadow-sm shadow-rose-100">
            🔥 年繳最划算・送 2 個月
          </span>
        </div>

        <div
          id={`${baseId}-plans`}
          className="mx-auto mt-8 grid max-w-4xl gap-5 md:grid-cols-2"
        >
          {activeCategory.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              accent="emerald"
              onSubscribe={() =>
                handleSubscribe(
                  activeCategory,
                  plan,
                  plan.recommended ? "founding" : "trial",
                )
              }
              onConsult={() => handleConsult(activeCategory, plan)}
              trialCta
              foundingCta={Boolean(plan.recommended)}
            />
          ))}
        </div>

        <div className="mx-auto mt-6 flex max-w-xl flex-col gap-2 text-center sm:flex-row sm:justify-center">
          <Button
            type="button"
            className="bg-teal-700 text-white hover:bg-teal-800"
            onClick={() => {
              const starter = activeCategory.plans.find((p) => p.id === "starter");
              if (starter) handleSubscribe(activeCategory, starter, "trial");
            }}
          >
            基礎版・先註冊申請試用
          </Button>
          <Button
            type="button"
            className="bg-amber-800 text-white hover:bg-amber-900"
            onClick={() => openFoundingCheckout()}
          >
            先註冊／免費申請創始（14 天試用＋續費 8 折）
          </Button>
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50 to-white p-5 sm:p-6">
          <p className="text-sm font-semibold tracking-wide text-stone-500">
            {REFERRAL_COPY.title}
          </p>
          <h3 className="mt-1 text-lg font-bold text-stone-900">
            {REFERRAL_COPY.headline}
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-600">
            <li>
              <span className="font-medium text-stone-800">觸發條件：</span>
              {REFERRAL_COPY.condition}
            </li>
            <li>
              <span className="font-medium text-stone-800">新店家：</span>
              {REFERRAL_COPY.newStoreBenefit}
            </li>
            <li>
              <span className="font-medium text-stone-800">推薦人：</span>
              {REFERRAL_COPY.referrerBenefit}
            </li>
          </ul>
          <p className="mt-3 text-xs font-medium text-rose-800">
            {REFERRAL_COPY.triggerNote}
          </p>
        </div>

        <p className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center text-sm leading-relaxed text-slate-600">
          {PRICING_NOTE}
          <span className="mt-1 block text-xs text-slate-400">
            年繳（主站權威）：基礎版 NT$3,588／年；旗艦版 NT$5,988／年＝月費 × 12
          </span>
        </p>

        <div className="mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-wide text-stone-600">
              核心預約能力
            </p>
            <h3 className="mt-2 text-xl font-bold text-stone-900 sm:text-2xl">
              從線上預約到二次回訪
            </h3>
            <p className="mt-2 text-sm text-stone-500">
              專注預約、通知與刮刮樂留客。
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {BOOKING_CORE_FEATURES.map((feature) => {
              const Icon = featureIcons[feature.id];
              return (
                <div
                  key={feature.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <Icon className="h-5 w-5 text-stone-700" />
                  <h4 className="mt-3 font-semibold text-stone-900">
                    {feature.title}
                  </h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SubscribeCheckoutDialog
        target={subscribeTarget}
        onClose={() => setSubscribeTarget(null)}
      />

      {billingToast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm text-emerald-900 shadow-xl">
          {billingToast}
        </div>
      ) : null}
    </section>
  );
}

function PlanCard({
  plan,
  billingCycle,
  onSubscribe,
  onConsult,
  foundingCta = false,
  trialCta = false,
}: {
  plan: PricingPlan;
  billingCycle: PricingBillingCycle;
  onSubscribe: () => void;
  onConsult: () => void;
  foundingCta?: boolean;
  /** 兩方案皆可先註冊開通試用店家 */
  trialCta?: boolean;
  accent?: "emerald" | "teal";
}) {
  const yearly = annualPrice(plan.monthlyPrice);
  const yearlyAvg = annualMonthlyEquivalent(plan.monthlyPrice);
  const foundingMonthly = applyFoundingDiscount(plan.monthlyPrice, true);
  const foundingYearly = applyFoundingDiscount(yearly, true);
  const isAnnual = billingCycle === "annual";
  const check = "text-stone-700";
  const ring = plan.recommended
    ? "border-rose-300/80 bg-gradient-to-b from-rose-50/40 to-white shadow-xl shadow-stone-900/5 ring-2 ring-rose-200/60 lg:-translate-y-1"
    : "border-stone-200 bg-gradient-to-b from-stone-50 to-white shadow-sm shadow-stone-900/5";

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-[1.5rem] border p-6 sm:p-7",
        ring,
      )}
    >
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-1 text-xs font-semibold text-stone-50 shadow-md">
            <Sparkles className="h-3.5 w-3.5" />
            美業熱銷首選
          </span>
        </div>
      )}

      <div className="min-w-0">
        <h3 className="text-lg font-bold text-stone-900 sm:text-xl">
          {plan.name}
        </h3>
        <p className="mt-0.5 text-xs font-medium tracking-wide text-stone-400">
          {plan.enName}
        </p>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-stone-500">
        <span className="font-medium text-stone-700">適合：</span>
        {plan.suitable}
      </p>

      <div
        key={billingCycle}
        className="mt-5 animate-[fadeIn_0.28s_ease]"
        aria-live="polite"
      >
        {isAnnual ? (
          <>
            <p className="text-3xl font-bold tracking-tight text-stone-900 tabular-nums sm:text-[2rem]">
              {formatTwd(yearly)}
              <span className="ml-1 text-sm font-medium text-stone-400">
                / 年
              </span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-500 sm:text-sm">
              相當於立省 2 個月，平均{" "}
              <span className="font-semibold tabular-nums text-stone-800">
                ${yearlyAvg.toLocaleString("en-US")}
              </span>
              /月
              {plan.recommended ? (
                <>
                  {" "}
                  ・創始年繳{" "}
                  <span className="font-semibold tabular-nums text-rose-800">
                    {formatTwd(foundingYearly)}
                  </span>
                  （8 折）
                </>
              ) : null}
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold tracking-tight text-stone-900 tabular-nums sm:text-[2rem]">
              {formatTwd(plan.monthlyPrice)}
              <span className="ml-1 text-sm font-medium text-stone-400">
                / 月
              </span>
            </p>
            {plan.recommended ? (
              <p className="mt-1.5 text-xs text-stone-500 sm:text-sm">
                前 15 組：14 天免費，續費{" "}
                <span className="font-semibold tabular-nums text-rose-800">
                  {formatTwd(foundingMonthly)}
                </span>
                <span className="text-stone-400">／月（8 折）</span>
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-stone-500 sm:text-sm">
                先註冊可申請試用店家・一天不到 10 元・年繳{" "}
                <span className="font-semibold tabular-nums text-stone-700">
                  {formatTwd(yearly)}
                </span>
              </p>
            )}
          </>
        )}
      </div>

      {plan.badges && plan.badges.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.badges.map((item) => (
            <span
              key={item}
              className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold tracking-wide text-stone-700"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-600">
        {plan.features.map((feature) => {
          const excluded = feature.startsWith("❌");
          const highlight = feature.startsWith("✨");
          return (
            <li key={feature} className="flex items-start gap-2.5">
              {excluded ? (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              ) : (
                <Check className={cn("mt-0.5 h-4 w-4 shrink-0", check)} />
              )}
              <span
                className={cn(
                  excluded && "text-slate-400",
                  highlight && "font-medium text-stone-900",
                )}
              >
                {feature.replace(/^[❌✨]\s*/, "")}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-7 space-y-2">
        <Button
          type="button"
          className={
            foundingCta
              ? "h-12 w-full bg-amber-800 text-base text-white hover:bg-amber-900"
              : "h-12 w-full bg-teal-700 text-base text-white hover:bg-teal-800"
          }
          variant={foundingCta || trialCta ? undefined : "primary"}
          onClick={onSubscribe}
        >
          {foundingCta
            ? "免費申請創始店家"
            : "先註冊・申請試用店家"}
        </Button>
        <Button
          type="button"
          className="h-10 w-full text-sm"
          variant="outline"
          onClick={onConsult}
        >
          {plan.cta.includes("諮詢") ? plan.cta : "預約諮詢／詢價"}
        </Button>
      </div>
    </article>
  );
}
