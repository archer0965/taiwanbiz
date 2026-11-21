import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BUSINESS_EMAIL, LINE_OFFICIAL_ID } from "@/lib/pricing";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt?: string;
  children: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  description,
  updatedAt = "2026-10-10",
  children,
}: Props) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-950 text-slate-100">
        <div className="border-b border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
            <p className="font-[family-name:var(--font-outfit)] text-xs font-semibold tracking-[0.2em] text-emerald-300/90 uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
              {description}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              最後更新日期：{updatedAt}｜聯絡：{BUSINESS_EMAIL}／LINE{" "}
              {LINE_OFFICIAL_ID}
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
              <Link href="/terms" className="text-emerald-300 hover:text-emerald-200">
                服務條款
              </Link>
              <Link
                href="/privacy"
                className="text-amber-200 hover:text-amber-100"
              >
                隱私權政策
              </Link>
              <Link href="/pricing" className="text-slate-300 hover:text-white">
                方案價格
              </Link>
            </div>
          </div>
        </div>

        <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-7"
    >
      <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-[0.95rem]">
        {children}
      </div>
    </section>
  );
}
