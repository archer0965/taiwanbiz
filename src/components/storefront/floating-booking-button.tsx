"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarCheck2 } from "lucide-react";

type Props = {
  className?: string;
  tone?: "brunch" | "nail" | "shop";
  label?: string;
};

export function FloatingBookingButton({
  className,
  tone = "nail",
  label = "立即預約",
}: Props) {
  const accent =
    tone === "nail"
      ? "bg-rose-400 text-slate-950 hover:bg-rose-300 shadow-rose-500/30"
      : tone === "shop"
        ? "bg-teal-400 text-slate-950 hover:bg-teal-300 shadow-teal-500/30"
        : "bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-amber-500/30";

  function scrollToBooking() {
    const el = document.getElementById("booking");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.location.hash = "booking";
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-50 flex justify-end px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6",
        // 未指定 bottom 時貼齊底部；可被 className 覆寫（例如避開行銷 CTA）
        !className?.includes("bottom-") && "bottom-0",
        className,
      )}
    >
      <Button
        type="button"
        onClick={scrollToBooking}
        className={cn(
          "pointer-events-auto h-12 rounded-full px-4 text-sm font-semibold shadow-2xl transition hover:-translate-y-0.5 sm:h-14 sm:px-6 sm:text-base",
          accent,
        )}
      >
        <CalendarCheck2 className="h-4 w-4 sm:h-5 sm:w-5" />
        {label}
      </Button>
    </div>
  );
}
