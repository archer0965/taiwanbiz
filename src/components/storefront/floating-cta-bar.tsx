"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Store } from "lucide-react";
import Link from "next/link";

type Props = {
  className?: string;
  tone?: "brunch" | "nail" | "shop";
};

export function FloatingCtaBar({ className, tone = "brunch" }: Props) {
  const accent =
    tone === "nail"
      ? "from-rose-500 to-violet-500 shadow-rose-500/25"
      : tone === "shop"
        ? "from-teal-400 to-cyan-500 shadow-teal-500/25"
        : "from-amber-500 to-emerald-500 shadow-amber-500/25";

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 sm:px-4",
        className,
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-5xl items-center gap-2.5 rounded-2xl border border-white/15 bg-slate-950/92 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl sm:gap-3 sm:p-3">
        <div className="hidden min-w-0 flex-1 items-center gap-3 pl-2 sm:flex">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <Store className="h-4 w-4 text-slate-200" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              喜歡這個店家前台嗎？
            </p>
            <p className="truncate text-xs text-slate-400">
              拓脈可幫您快速建置官網與刮刮樂行銷
            </p>
          </div>
        </div>
        <Link href="/#contact" className="min-w-0 flex-1 sm:flex-none">
          <Button
            as="span"
            className={cn(
              "h-11 w-full bg-gradient-to-r px-3 text-sm text-slate-950 sm:h-11 sm:w-auto sm:px-5 sm:text-base",
              accent,
            )}
          >
            <span className="truncate sm:hidden">我也想開店網站</span>
            <span className="hidden truncate sm:inline">
              我也想為我的店做一個這樣的網站
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
