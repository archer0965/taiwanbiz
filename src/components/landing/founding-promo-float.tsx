"use client";

import {
  FOUNDING_BENEFITS,
  FOUNDING_FREE_LABEL,
  FOUNDING_MEMBER_LIMIT,
} from "@/lib/pricing";
import { useClientReady } from "@/lib/use-client-ready";
import { Gift, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "taiwanbiz-founding-float-dismissed";

type FoundingState = {
  remaining: number;
  limit: number;
  available: boolean;
};

function subscribeDismissed(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("taiwanbiz-founding-float", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("taiwanbiz-founding-float", onStoreChange);
  };
}

function readDismissed() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 主頁上方浮動框：彙整前 15 組創始全部優惠項目
 */
export function FoundingPromoFloat() {
  const ready = useClientReady();
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    () => true,
  );
  const [founding, setFounding] = useState<FoundingState | null>(null);

  useEffect(() => {
    if (!ready || dismissed) return;
    let cancelled = false;
    void fetch("/api/founding", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok) return;
        setFounding({
          remaining: Number(data.remaining) || 0,
          limit: Number(data.limit) || FOUNDING_MEMBER_LIMIT,
          available: Boolean(data.available),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready, dismissed]);

  if (!ready || dismissed) return null;

  const soldOut = founding ? !founding.available : false;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-14 z-[60] flex justify-center px-3 pt-2 sm:top-16 sm:px-4"
      role="region"
      aria-label="前十組創始優惠"
    >
      <div className="pointer-events-auto w-full max-w-3xl animate-fade-in-up rounded-2xl border border-[#c4a090]/55 bg-[#1a1512] text-[#f7efe8] shadow-[0_18px_50px_rgba(20,14,10,0.55)]">
        <div className="flex items-start gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c4a090]/25 text-[#f0e0d4]">
            <Gift className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-wide text-[#f0e0d4] sm:text-base">
                {FOUNDING_FREE_LABEL}
              </p>
              <p className="text-[11px] text-[#f0e0d4]/80 sm:text-xs">
                {soldOut
                  ? "名額已額滿"
                  : founding
                    ? `剩餘 ${founding.remaining}/${founding.limit}`
                    : `限量 ${FOUNDING_MEMBER_LIMIT} 組`}
              </p>
            </div>
            <ul className="mt-1.5 hidden gap-0.5 text-[11px] leading-relaxed text-[#f7efe8] sm:grid sm:grid-cols-2 sm:text-xs">
              {FOUNDING_BENEFITS.map((item) => (
                <li key={item} className="flex gap-1.5">
                  <span className="mt-[0.35em] h-1 w-1 shrink-0 rounded-full bg-[#c4a090]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] leading-relaxed text-[#f7efe8]/90 sm:hidden">
              14 天全功能試用・續費終身 8 折・綠界線上付款・忘記續費可保留 30 天
            </p>
            {!soldOut ? (
              <Link
                href="/?founding=1#pricing"
                className="mt-2 inline-flex text-xs font-semibold text-[#c4a090] underline-offset-2 hover:underline sm:text-sm"
              >
                立即鎖定創始名額
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="關閉創始優惠提示"
            className="shrink-0 rounded-lg p-1.5 text-[#e8d5c8]/70 hover:bg-white/10 hover:text-[#f0e6de]"
            onClick={() => {
              try {
                sessionStorage.setItem(STORAGE_KEY, "1");
              } catch {
                /* ignore */
              }
              window.dispatchEvent(new Event("taiwanbiz-founding-float"));
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
