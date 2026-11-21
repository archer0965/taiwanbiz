import { FaqSection } from "@/components/landing/faq-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { LineCtaLink } from "@/components/line-cta-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "方案定價｜拓脈（Nova Crest Pulse）",
  description:
    "極速預約基礎版月繳 NT$299／年繳 NT$3,588；品牌導流旗艦版月繳 NT$499／年繳 NT$5,988（與 NovaOS 主站對齊）。",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-gradient-to-b from-stone-50 via-white to-stone-100/60">
        <div className="border-b border-stone-200/80 bg-stone-950 text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <p className="font-[family-name:var(--font-outfit)] text-xs font-semibold tracking-[0.2em] text-stone-400 uppercase">
              Nova Crest Pulse
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
              純預約雙方案
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-300 sm:text-base">
              極速預約基礎版與品牌導流旗艦版。兩張卡片對比，一眼選完。
            </p>
            <div className="mt-6 flex flex-wrap gap-5 text-sm font-semibold">
              <Link
                href="/#cases"
                className="text-stone-200 underline-offset-4 hover:text-white hover:underline"
              >
                查看基礎／旗艦預覽
              </Link>
              <LineCtaLink className="text-stone-400 hover:text-white">
                預約諮詢（LINE）→
              </LineCtaLink>
            </div>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="mx-auto max-w-6xl px-4 py-16">
              <div className="h-80 animate-pulse rounded-2xl bg-stone-200" />
            </div>
          }
        >
          <PricingSection showHeading={false} className="pt-10" />
        </Suspense>
        <FaqSection />
      </main>
      <SiteFooter />
    </>
  );
}
