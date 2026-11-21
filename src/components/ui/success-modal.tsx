"use client";

import { Button } from "@/components/ui/button";
import { LINE_FRIEND_URL } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CheckCircle2, MessageCircle, X } from "lucide-react";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
};

export function SuccessModal({
  open,
  onClose,
  title = "感謝您的預約！",
  description = "拓脈團隊已收到您的需求，將於 1 個工作日內透過 LINE 與您聯繫。",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="關閉彈窗"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-md animate-[slideUp_0.35s_ease] overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950 text-white shadow-2xl shadow-black/40",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.25),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(245,158,11,0.15),transparent_35%)]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="關閉"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-6 pb-7 pt-8 sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
            <CheckCircle2 className="h-7 w-7 text-emerald-300" />
          </div>
          <h2
            id="success-modal-title"
            className="mt-5 text-center text-2xl font-bold tracking-tight"
          >
            {title}
          </h2>
          <p className="mt-3 text-center text-sm leading-relaxed text-slate-300">
            {description}
          </p>

          <div className="mt-7 space-y-3">
            <a
              href={LINE_FRIEND_URL}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Button
                as="span"
                className="h-12 w-full bg-emerald-500 text-base text-slate-950 hover:bg-emerald-400"
              >
                <MessageCircle className="h-4 w-4" />
                直接加 LINE 官方帳號諮詢
              </Button>
            </a>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={onClose}
            >
              先關閉，稍後再聯繫
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
