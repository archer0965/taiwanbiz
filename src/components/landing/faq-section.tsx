"use client";

import { LineCtaLink } from "@/components/line-cta-link";
import { PRICING_FAQS } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type Props = {
  className?: string;
};

export function FaqSection({ className }: Props) {
  const [openId, setOpenId] = useState<string | null>(PRICING_FAQS[0]?.id ?? null);

  return (
    <section
      id="faq"
      className={cn("relative scroll-mt-24 py-16 sm:py-20", className)}
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold tracking-wide text-emerald-700">
            常見問題
          </p>
          <h2
            id="faq-heading"
            className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            簽約前最常被問到的事
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            若還有其他問題，歡迎{" "}
            <LineCtaLink className="font-semibold text-emerald-700 hover:text-emerald-600">
              透過 LINE 預約諮詢
            </LineCtaLink>
            ，我們會盡快回覆。
          </p>
        </div>

        <div className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          {PRICING_FAQS.map((item) => {
            const open = openId === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                  aria-expanded={open}
                  aria-controls={`faq-panel-${item.id}`}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span className="text-sm font-semibold text-slate-900 sm:text-base">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300",
                      open && "rotate-180 text-emerald-600",
                    )}
                  />
                </button>
                <div
                  id={`faq-panel-${item.id}`}
                  role="region"
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 sm:px-6">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
