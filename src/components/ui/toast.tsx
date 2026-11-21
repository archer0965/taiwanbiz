"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

type ToastProps = {
  open: boolean;
  message: string;
  onClose: () => void;
  variant?: "success" | "error";
};

export function Toast({
  open,
  message,
  onClose,
  variant = "success",
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  const Icon = variant === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:justify-end sm:p-0">
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-md animate-[slideUp_0.35s_ease] items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl shadow-slate-900/10 sm:min-w-[280px] sm:w-auto",
          variant === "success"
            ? "border-emerald-100 bg-white text-slate-800"
            : "border-rose-100 bg-white text-slate-800",
        )}
        role="status"
        aria-live="polite"
      >
        <Icon
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            variant === "success" ? "text-emerald-600" : "text-rose-500",
          )}
        />
        <p className="flex-1 text-sm font-medium leading-relaxed break-words">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="關閉提示"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
