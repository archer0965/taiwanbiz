"use client";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ExternalLink, LayoutDashboard, Store } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function WelcomeClient() {
  const searchParams = useSearchParams();
  const storeId = (searchParams.get("storeId") || "").trim().toLowerCase();
  const isMock = searchParams.get("mock") === "1";
  const isTrial = searchParams.get("trial") === "1";
  const [status, setStatus] = useState<string>("查詢中…");
  const [active, setActive] = useState(false);
  const [onTrial, setOnTrial] = useState(isTrial);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setStatus("缺少 storeId");
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(storeId)}/status`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (cancelled) return;
        if (!data.found) {
          setStatus("店家建立中，請稍候…");
          return;
        }
        setStatus(data.status || "Pending");
        setActive(data.status === "Active");
        setOnTrial(Boolean(data.onTrial) || isTrial);
        setTrialEndsAt(data.trialEndsAt || null);
      } catch {
        if (!cancelled) setStatus("無法確認狀態");
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [storeId, isTrial]);

  const storeUrl = storeId ? `/stores/${encodeURIComponent(storeId)}` : "/pricing";
  const trialEndLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.14),_transparent_50%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
        <div className="mb-6 flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <p className="text-sm font-bold text-white">拓脈 Nova Crest Pulse</p>
            <p className="text-xs text-slate-400">
              {onTrial ? "14 天免費試用" : "自主訂閱開通"}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
          <h1 className="text-2xl font-bold text-white">
            {onTrial
              ? "試用已開通"
              : active || isMock
                ? "網站已建立"
                : "付款確認中"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {storeId ? (
              onTrial ? (
                <>
                  店家代號{" "}
                  <span className="font-mono text-teal-200">{storeId}</span>
                  。您可立即用開通時設定的 Email＋密碼登入後台編輯獨立網站；試用期內免付費，
                  {trialEndLabel ? (
                    <>截止前（{trialEndLabel}）請至「訂閱付款」完成正式訂閱。</>
                  ) : (
                    <>截止前請至「訂閱付款」完成正式訂閱。</>
                  )}
                </>
              ) : (
                <>
                  店家代號 <span className="font-mono text-teal-200">{storeId}</span>
                  。完成綠界線上付款後，狀態會改為 Active；您即可用結帳
                  Email＋密碼登入後台，自行編輯獨立網站。
                </>
              )
            ) : (
              "請從訂閱結帳流程進入此頁。"
            )}
          </p>

          <dl className="mt-5 grid gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <dt className="text-slate-500">目前狀態</dt>
              <dd className="mt-1 font-semibold text-teal-200">
                {onTrial ? `${status}（試用中）` : status}
              </dd>
            </div>
            {trialEndLabel ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <dt className="text-slate-500">試用截止</dt>
                <dd className="mt-1 font-semibold text-amber-200">
                  {trialEndLabel}
                </dd>
              </div>
            ) : null}
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <dt className="text-slate-500">前台網址</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-200">
                {storeUrl}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-2">
            <Link href={storeUrl}>
              <Button as="span" className="h-11 w-full bg-teal-400 text-slate-950 hover:bg-teal-300">
                <Store className="h-4 w-4" />
                查看我的獨立前台
              </Button>
            </Link>
            <Link href="/login">
              <Button
                as="span"
                variant="outline"
                className="h-11 w-full border-white/15 bg-transparent text-slate-100 hover:bg-white/10"
              >
                <LayoutDashboard className="h-4 w-4" />
                登入店家後台開始編輯
              </Button>
            </Link>
            {onTrial ? (
              <Link href="/dashboard/billing">
                <Button
                  as="span"
                  variant="outline"
                  className="h-11 w-full border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                >
                  試用結束前完成正式訂閱
                </Button>
              </Link>
            ) : null}
            <Link href="/pricing">
              <Button
                as="span"
                variant="outline"
                className="h-11 w-full border-white/10 bg-transparent text-slate-400 hover:bg-white/5"
              >
                <ExternalLink className="h-4 w-4" />
                返回方案頁
              </Button>
            </Link>
          </div>

          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            登入後可自行修改店名、服務項目、營業時段與刮刮樂活動。若狀態仍為
            Pending，請至「訂閱付款」以綠界完成線上付款開通。
          </p>
        </div>
      </div>
    </div>
  );
}
