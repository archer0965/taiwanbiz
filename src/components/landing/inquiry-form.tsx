"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SuccessModal } from "@/components/ui/success-modal";
import { Textarea } from "@/components/ui/textarea";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";
import {
  interestedPlanOptions,
  resolveInterestedPlan,
  STORE_TYPE_OPTIONS,
  UNDECIDED_PLAN_OPTION,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const fieldClass =
  "border-white/15 bg-slate-800 text-white placeholder:text-slate-500 focus:border-emerald-400/60 focus:ring-emerald-400/15";
const labelClass = "text-slate-200";
const selectClass = cn(
  "h-11 w-full appearance-none rounded-xl border px-3.5 text-base shadow-sm outline-none transition sm:text-sm",
  fieldClass,
  "bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10",
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%2394a3b8%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E')]",
);

function resolvePlanValue(raw: string, planOptions: string[]) {
  if (!raw.trim()) return "";
  const resolved = resolveInterestedPlan(raw);
  return planOptions.includes(resolved) ? resolved : UNDECIDED_PLAN_OPTION;
}

export function InquiryForm() {
  const searchParams = useSearchParams();
  const planOptions = useMemo(() => interestedPlanOptions(), []);
  const planParam = searchParams.get("plan") ?? "";
  const planFromUrl = useMemo(
    () => resolvePlanValue(planParam, planOptions),
    [planParam, planOptions],
  );

  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(planFromUrl);
  const [prevPlanParam, setPrevPlanParam] = useState(planParam);
  const [need, setNeed] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // 依 URL ?plan= 同步（React 建議的 props→state 調整方式，避免 effect setState）
  if (planParam !== prevPlanParam) {
    setPrevPlanParam(planParam);
    setSelectedPlan(planFromUrl);
  }

  const applyPlan = useCallback(
    (plan: string) => {
      if (!plan.trim()) return;
      setSelectedPlan(resolvePlanValue(plan, planOptions));
    },
    [planOptions],
  );

  useEffect(() => {
    function onSelect(e: Event) {
      const detail = (e as CustomEvent<{ plan?: string }>).detail;
      if (detail?.plan) applyPlan(detail.plan);
    }
    window.addEventListener("taiwanbiz-select-plan", onSelect);
    return () => window.removeEventListener("taiwanbiz-select-plan", onSelect);
  }, [applyPlan]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !storeName.trim()) {
      setError("請填寫聯絡人與店家名稱");
      return;
    }
    if (!storeType) {
      setError("請選擇店面類型");
      return;
    }
    const normalized = normalizeTaiwanMobile(phone);
    if (!isValidTaiwanMobile(normalized)) {
      setError("請輸入正確的台灣手機號碼（09 開頭共 10 碼）");
      return;
    }
    if (!lineId.trim() || lineId.trim().length < 2) {
      setError("請填寫 LINE ID，方便我們快速回覆");
      return;
    }
    if (!selectedPlan) {
      setError("請選擇感興趣的方案");
      return;
    }

    const trimmedNeed = need.trim();
    const needPayload = trimmedNeed
      ? trimmedNeed
      : `我想了解方案：${selectedPlan}`;

    setLoading(true);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          storeName: storeName.trim(),
          storeType,
          phone: normalized,
          lineId: lineId.trim(),
          plan: selectedPlan,
          need: needPayload,
          website: honeypot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error || "送出失敗，請稍後再試");
        return;
      }

      setName("");
      setStoreName("");
      setStoreType("");
      setPhone("");
      setLineId("");
      setNeed("");
      setSelectedPlan("");
      setModalOpen(true);
    } catch {
      setError("網路異常，請稍後再試或直接加 LINE 聯絡我們");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="relative space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="inq-name" className={labelClass}>
              聯絡人
            </Label>
            <Input
              id="inq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="您的姓名"
              autoComplete="name"
              disabled={loading}
              maxLength={40}
              className={fieldClass}
            />
          </div>
          <div>
            <Label htmlFor="inq-store" className={labelClass}>
              店家／品牌名稱
            </Label>
            <Input
              id="inq-store"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="例如：巷弄晨光咖啡"
              disabled={loading}
              maxLength={80}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="inq-store-type" className={labelClass}>
            店面類型
          </Label>
          <select
            id="inq-store-type"
            value={storeType}
            onChange={(e) => setStoreType(e.target.value)}
            disabled={loading}
            className={selectClass}
            style={{ colorScheme: "dark" }}
            required
          >
            <option value="" disabled>
              請選擇店面類型
            </option>
            {STORE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="inq-phone" className={labelClass}>
              手機號碼
            </Label>
            <Input
              id="inq-phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              autoComplete="tel"
              disabled={loading}
              maxLength={20}
              className={fieldClass}
            />
          </div>
          <div>
            <Label htmlFor="inq-line" className={labelClass}>
              LINE ID（必填）
            </Label>
            <Input
              id="inq-line"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              placeholder="例如：cafe_owner01"
              autoComplete="off"
              disabled={loading}
              maxLength={40}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="inq-plan" className={labelClass}>
            感興趣的方案
          </Label>
          <select
            id="inq-plan"
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            disabled={loading}
            className={selectClass}
            style={{ colorScheme: "dark" }}
            required
          >
            <option value="" disabled>
              請選擇感興趣的方案
            </option>
            {planOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-400">
            點擊上方方案的「立即選擇／預約諮詢」會自動帶入對應方案
          </p>
        </div>

        <div>
          <Label htmlFor="inq-need" className={labelClass}>
            需求說明（選填）
          </Label>
          <Textarea
            id="inq-need"
            value={need}
            onChange={(e) => setNeed(e.target.value)}
            placeholder="例如：想做官網＋週年慶刮刮樂，希望一週內上線"
            disabled={loading}
            maxLength={2000}
            className={fieldClass}
          />
        </div>

        <div
          aria-hidden
          className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        >
          <Label htmlFor="inq-website">網站</Label>
          <Input
            id="inq-website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-rose-400" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full bg-emerald-500 text-base text-slate-950 hover:bg-emerald-400"
          disabled={loading}
        >
          {loading ? "送出中…" : "送出需求"}
        </Button>
        <p className="text-xs leading-relaxed text-slate-400">
          送出後拓脈團隊將於 1 個工作日內以 LINE
          與您聯繫。不需另外提供 Gmail。
        </p>
      </form>

      <SuccessModal open={modalOpen} onClose={closeModal} />
    </>
  );
}
