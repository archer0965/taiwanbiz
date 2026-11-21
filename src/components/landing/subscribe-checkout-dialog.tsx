"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  annualPrice,
  applyFoundingDiscount,
  FOUNDING_FREE_LABEL,
  FOUNDING_MEMBER_LIMIT,
  FOUNDING_TRIAL_DAYS,
  STANDARD_TRIAL_DAYS,
  formatTwd,
  type PricingBillingCycle,
  TRIAL_LABEL,
  type PricingCategory,
  type PricingPlan,
} from "@/lib/pricing";
import {
  REFERRAL_COPY,
  normalizeReferralCode,
  referralCodeFromStoreId,
  referralCodesEqual,
} from "@/lib/referral";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

export type SubscribeTarget = {
  category: PricingCategory;
  plan: PricingPlan;
  billingCycle?: PricingBillingCycle;
  /** founding：預設勾選創始；trial：先註冊開試用（基礎／旗艦皆可） */
  intent?: "founding" | "trial" | "paid";
};

type Props = {
  target: SubscribeTarget | null;
  onClose: () => void;
};

type FoundingState = {
  available: boolean;
  used: number;
  remaining: number;
  limit: number;
};

function toStoreId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
    .replace(/[\u4e00-\u9fff]/g, (ch) => `u${ch.codePointAt(0)?.toString(16)}`)
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function SubscribeCheckoutDialog({ target, onClose }: Props) {
  const [storeName, setStoreName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFoundingMember, setIsFoundingMember] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [founding, setFounding] = useState<FoundingState | null>(null);
  const [existingFounding, setExistingFounding] = useState(false);
  const [emailHasPassword, setEmailHasPassword] = useState(false);

  useEffect(() => {
    if (!target) return;
    setError("");
    setSuccessMessage("");
    setBusy(false);
    // 創始入口預設勾選；基礎版／一般試用入口不強制創始（仍可自行勾選）
    setIsFoundingMember(target.intent === "founding");
    void fetch("/api/founding", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const next = {
          available: Boolean(data.available),
          used: Number(data.used) || 0,
          remaining: Number(data.remaining) || 0,
          limit: Number(data.limit) || FOUNDING_MEMBER_LIMIT,
        };
        setFounding(next);
        if (!next.available && !existingFounding) {
          setIsFoundingMember(false);
        } else if (target.intent === "founding" && next.available) {
          setIsFoundingMember(true);
        }
      })
      .catch(() => undefined);
  }, [target, existingFounding]);

  useEffect(() => {
    const id = (storeId.trim() || toStoreId(storeName)).trim();
    if (!target || id.length < 2) {
      setExistingFounding(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/founding?storeId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((data) => {
          setExistingFounding(Boolean(data?.isFoundingMember));
        })
        .catch(() => setExistingFounding(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [storeId, storeName, target]);

  useEffect(() => {
    const mail = email.trim().toLowerCase();
    if (!mail.includes("@")) {
      setEmailHasPassword(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(
        `/api/auth/password-status?email=${encodeURIComponent(mail)}`,
        { cache: "no-store" },
      )
        .then((r) => r.json())
        .then((data) => setEmailHasPassword(Boolean(data?.hasPassword)))
        .catch(() => setEmailHasPassword(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [email]);

  if (!target) return null;

  const selected = target;
  const billingCycle = selected.billingCycle || "monthly";
  const listAmount =
    billingCycle === "annual"
      ? annualPrice(selected.plan.monthlyPrice)
      : selected.plan.monthlyPrice;
  const foundingOn = existingFounding || isFoundingMember;
  const foundingSoldOut = Boolean(founding && !founding.available && !existingFounding);
  const foundingEligible = foundingOn && !foundingSoldOut;
  /** 試用結束後續費價（創始＝8 折） */
  const afterFounding = applyFoundingDiscount(listAmount, foundingEligible);
  const planName = `${selected.plan.name}${
    billingCycle === "annual" ? "（年繳）" : "（月繳）"
  }`;

  /** 創始申請＝14 天試用；額滿後＝3 天試用。先註冊；續費改由後台對帳 */
  const foundingTrialSignup = foundingEligible;

  function assertReferralNotSelf(resolvedStoreId: string) {
    const code = normalizeReferralCode(referralCode);
    if (!code) return true;
    const own = referralCodeFromStoreId(resolvedStoreId);
    if (
      referralCodesEqual(code, resolvedStoreId) ||
      referralCodesEqual(code, own)
    ) {
      setError(REFERRAL_COPY.selfReferralError);
      return false;
    }
    return true;
  }

  async function submitTrialOrFoundingFree() {
    setError("");
    setSuccessMessage("");
    if (!storeName.trim() || !email.trim()) {
      setError("請填寫店名與 Email");
      return;
    }
    if (!emailHasPassword) {
      if (password.length < 8) {
        setError("請設定登入密碼（至少 8 碼，含英文與數字）");
        return;
      }
      if (password !== confirmPassword) {
        setError("兩次輸入的密碼不一致");
        return;
      }
    }
    const resolvedStoreId = (storeId.trim() || toStoreId(storeName)).trim();
    if (!assertReferralNotSelf(resolvedStoreId)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planName,
          amount: Math.max(1, listAmount),
          storeId: resolvedStoreId,
          isFoundingMember: foundingTrialSignup,
          activateFoundingFree: foundingTrialSignup,
          paymentType: "credit",
          ownerEmail: email.trim().toLowerCase(),
          name: storeName.trim(),
          startTrial: true,
          password: emailHasPassword ? undefined : password,
          confirmPassword: emailHasPassword ? undefined : confirmPassword,
          planType: "self-serve",
          referralCode: normalizeReferralCode(referralCode) || undefined,
          billingCycle,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        redirectUrl?: string;
        mode?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "開通失敗");
      setSuccessMessage(
        data.message ||
          (foundingTrialSignup
            ? `創始名額開通成功（${FOUNDING_TRIAL_DAYS} 天免費試用）`
            : `已先註冊並開通 ${STANDARD_TRIAL_DAYS} 天免費試用`),
      );
      if (data.redirectUrl) {
        window.setTimeout(() => {
          window.location.href = data.redirectUrl!;
        }, 700);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "開通失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscribe-checkout-title"
        className="scroll-y-touch w-full max-w-lg max-h-[min(92dvh,880px)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p
              className={
                foundingTrialSignup
                  ? "text-xs font-semibold tracking-wide text-amber-700 uppercase"
                  : "text-xs font-semibold tracking-wide text-teal-700 uppercase"
              }
            >
              {foundingTrialSignup ? "Founding Trial" : "Register First"}
            </p>
            <h2
              id="subscribe-checkout-title"
              className="mt-1 text-lg font-bold text-slate-900"
            >
              {foundingTrialSignup
                ? `免費申請創始店家｜${target.plan.name}`
                : `先註冊開通｜${target.plan.name}`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {foundingTrialSignup
                ? `${planName} · 前 ${FOUNDING_TRIAL_DAYS} 天免費試用；之後續費終身 8 折`
                : `${planName} · 先註冊享 ${STANDARD_TRIAL_DAYS} 天${TRIAL_LABEL}，剩餘 1 天提醒續費`}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {foundingTrialSignup
                ? `試用期應付 ${formatTwd(0)}｜試用後續費 ${formatTwd(afterFounding)}${billingCycle === "annual" ? "／年" : "／月"}（8 折）`
                : `試用期應付 ${formatTwd(0)}｜試用後原價 ${formatTwd(listAmount)}${billingCycle === "annual" ? "／年" : "／月"}；忘記續費可保留網站 30 天`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitTrialOrFoundingFree();
          }}
          className="space-y-3.5"
        >
          {foundingTrialSignup ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <p className="text-sm font-semibold">創始名額：{FOUNDING_FREE_LABEL}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                限量前 {FOUNDING_MEMBER_LIMIT} 組。送出後先註冊並開通{" "}
                {FOUNDING_TRIAL_DAYS}{" "}
                天免費試用（無需付款）。試用結束後請以綠界線上付款續費，每次續費終身 8 折（
                {formatTwd(afterFounding)}
                {billingCycle === "annual" ? "／年" : "／月"}
                ）。忘記續費可保留網站 30 天。
                {founding
                  ? ` 目前剩餘 ${founding.remaining}/${founding.limit}。`
                  : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-teal-950">
              <p className="text-sm font-semibold">
                先註冊・{STANDARD_TRIAL_DAYS} 天免費試用
              </p>
              <p className="mt-1 text-xs leading-relaxed text-teal-900/80">
                創始名額已額滿或未勾選創始。送出後先開通帳號與前台，享{" "}
                {STANDARD_TRIAL_DAYS}{" "}
                天全功能試用；剩餘 1 天會提醒續費。試用後再於後台以綠界正式訂閱。忘記續費可保留網站 30 天。
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="sub-store-name">店家名稱</Label>
            <Input
              id="sub-store-name"
              value={storeName}
              onChange={(e) => {
                setStoreName(e.target.value);
                if (!storeId) setStoreId(toStoreId(e.target.value));
              }}
              placeholder="例：澄光美甲工作室"
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label htmlFor="sub-store-id">storeId（前台網址代號）</Label>
            <Input
              id="sub-store-id"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              placeholder="例：nail-studio"
              className="mt-1.5 font-mono text-sm"
              required
            />
          </div>
          <div>
            <Label htmlFor="sub-email">負責人 Email</Label>
            <Input
              id="sub-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="sub-referral">美業同業推薦碼（選填）</Label>
            <Input
              id="sub-referral"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="例：REF-SHOP123"
              className="mt-1.5 font-mono text-sm"
              maxLength={24}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              {REFERRAL_COPY.newStoreBenefit}
              {REFERRAL_COPY.condition}
              {REFERRAL_COPY.selfReferralError}。
              {REFERRAL_COPY.triggerNote}
            </p>
          </div>

          {!emailHasPassword ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold text-slate-600">
                設定登入密碼（後台 Email＋密碼登入）
              </p>
              <div>
                <Label htmlFor="sub-password">密碼</Label>
                <Input
                  id="sub-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 碼，含英文與數字"
                  className="mt-1.5"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <Label htmlFor="sub-password2">再次確認密碼</Label>
                <Input
                  id="sub-password2"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再輸入一次"
                  className="mt-1.5"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              此 Email 已綁定登入密碼，開通後請以原密碼登入後台。
            </p>
          )}

          {existingFounding ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              您已是創始會員：續費終身 8 折（
              {formatTwd(applyFoundingDiscount(listAmount, true))}）
            </p>
          ) : !foundingSoldOut ? (
            foundingTrialSignup && target.intent === "founding" ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                已套用創始名額：前 {FOUNDING_TRIAL_DAYS} 天免費，之後續費 8 折
                <span className="mt-0.5 block text-xs text-amber-800/80">
                  試用應付 {formatTwd(0)}｜續費{" "}
                  {formatTwd(afterFounding)}
                  {founding
                    ? ` · 剩餘 ${founding.remaining}/${founding.limit}`
                    : ""}
                </span>
              </p>
            ) : (
              <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={isFoundingMember}
                  onChange={(e) => setIsFoundingMember(e.target.checked)}
                />
                <span>
                  創始會員限量 {FOUNDING_MEMBER_LIMIT} 組：前{" "}
                  {FOUNDING_TRIAL_DAYS} 天免費＋續費終身 8 折
                  <span className="mt-0.5 block text-xs text-amber-800/80">
                    勾選後先註冊開通免費試用；試用後續費{" "}
                    {formatTwd(applyFoundingDiscount(listAmount, true))}
                    {founding
                      ? ` · 剩餘 ${founding.remaining}/${founding.limit}`
                      : ""}
                    。取消勾選則先註冊享 {STANDARD_TRIAL_DAYS} 天試用。
                  </span>
                </span>
              </label>
            )
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              創始名額已額滿。先註冊可享 {STANDARD_TRIAL_DAYS}{" "}
              天免費試用，之後原價 {formatTwd(listAmount)}。
            </p>
          )}

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {successMessage ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {successMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="button"
              disabled={busy}
              className={
                foundingTrialSignup
                  ? "w-full bg-amber-700 hover:bg-amber-800"
                  : "w-full bg-teal-600 hover:bg-teal-700"
              }
              onClick={() => void submitTrialOrFoundingFree()}
            >
              {busy
                ? "處理中…"
                : foundingTrialSignup
                  ? `免費申請創始店家（${FOUNDING_TRIAL_DAYS} 天試用）`
                  : `先註冊・開始 ${STANDARD_TRIAL_DAYS} 天免費試用`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="w-full border-transparent text-slate-500"
            >
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
