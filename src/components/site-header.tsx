"use client";

import { BrandLogo } from "@/components/brand-logo";
import { DeveloperOnly } from "@/components/developer-only";
import { LineCtaLink } from "@/components/line-cta-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  CircleHelp,
  Globe2,
  LayoutGrid,
  MessageCircle,
  Menu,
  Scissors,
  Shield,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  description?: string;
  icon?: typeof Globe2;
};

const primaryNav: NavItem[] = [
  {
    href: "/#demo",
    label: "互動 Demo",
    description: "美甲／美髮 × 基礎版／旗艦版預覽試玩",
    icon: Sparkles,
  },
  {
    href: "/#features",
    label: "功能亮點",
    description: "防撞期、黑名單、離峰折扣與 LINE 通知",
    icon: LayoutGrid,
  },
  {
    href: "/#cases",
    label: "示範前台",
    description: "澄光美甲與絲光髮廊，各含基礎／旗艦版",
    icon: Scissors,
  },
  {
    href: "/pricing",
    label: "方案價格",
    description: "前 15 組：14 天免費＋續費 8 折・綠界付款",
    icon: Wallet,
  },
  {
    href: "/#faq",
    label: "常見問題",
    description: "試用、升降級與網址說明",
    icon: CircleHelp,
  },
  {
    href: "/#contact",
    label: "申請／諮詢",
    description: "免費申請創始店家或留下需求",
    icon: MessageCircle,
  },
];

const secondaryNav: NavItem[] = [
  {
    href: "/stores/nail-studio?preset=basic#booking",
    label: "美甲・基礎版",
    description: "純預約單頁：服務、時段、條款一次完成",
    icon: Globe2,
  },
  {
    href: "/stores/nail-studio?preset=premium#booking",
    label: "美甲・旗艦版",
    description: "品牌官網＋作品集與刮刮樂留客",
    icon: Globe2,
  },
  {
    href: "/stores/hair-salon?preset=basic#booking",
    label: "美髮・基礎版",
    description: "純預約單頁：剪燙時段與條款",
    icon: Scissors,
  },
  {
    href: "/stores/hair-salon?preset=premium#booking",
    label: "美髮・旗艦版",
    description: "品牌官網＋設計師與離峰折扣展示",
    icon: Scissors,
  },
  {
    href: "/terms",
    label: "服務條款",
    description: "訂閱、自主經營範圍與解約規範",
    icon: Shield,
  },
  {
    href: "/privacy",
    label: "隱私權政策",
    description: "個資蒐集與個資法承諾",
    icon: Shield,
  },
];

const desktopNav = [
  { href: "/#demo", label: "Demo" },
  { href: "/#features", label: "功能" },
  { href: "/#cases", label: "示範" },
  { href: "/pricing", label: "方案" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#contact", label: "申請" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* 浮動頂部導覽列：捲到哪都固定可點 */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled || open ? "pt-2 sm:pt-3" : "pt-0",
        )}
      >
        <div
          className={cn(
            "mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 transition-all duration-300 sm:h-16 sm:px-6",
            scrolled || open
              ? "mx-3 max-w-[calc(100%-1.5rem)] rounded-2xl border border-white/15 bg-slate-950/90 px-3 shadow-2xl shadow-black/40 backdrop-blur-xl sm:mx-auto sm:max-w-6xl sm:px-5"
              : "border-b border-white/10 bg-slate-950/80 backdrop-blur-xl",
          )}
        >
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5"
            onClick={() => setOpen(false)}
          >
            <BrandLogo
              size={36}
              className="transition group-hover:scale-105"
              priority
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold tracking-wide text-white">
                拓脈
              </span>
              <span className="block text-[11px] font-medium tracking-[0.12em] text-amber-200/80">
                Nova Crest Pulse
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {desktopNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <LineCtaLink className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/10 hover:text-emerald-200">
              LINE 諮詢
            </LineCtaLink>
          </nav>

          <div className="hidden items-center gap-2 md:flex lg:gap-3">
            <DeveloperOnly>
              <Link href="/login">
                <Button
                  as="span"
                  variant="ghost"
                  className="text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  Google 登入
                </Button>
              </Link>
              <Link href="/admin/dashboard">
                <Button
                  as="span"
                  variant="ghost"
                  className="text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  總管
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  as="span"
                  variant="ghost"
                  className="text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  後台
                </Button>
              </Link>
            </DeveloperOnly>
            <Link href="/#pricing">
              <Button as="span" size="sm">
                申請創始店家
              </Button>
            </Link>
          </div>

          <button
            type="button"
            className="touch-target inline-flex items-center justify-center rounded-xl p-2.5 text-slate-200 hover:bg-white/10 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "關閉選單" : "開啟選單"}
            aria-expanded={open}
            data-testid="mobile-menu-toggle"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* 佔位，避免 fixed header 蓋住首屏內容 */}
      <div className="h-14 sm:h-16" aria-hidden />

      {/* 浮動全螢幕選單（手機）：跟隨 header，滑到哪都能開 */}
      <div
        data-testid="mobile-menu"
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          aria-label="關閉選單背景"
          onClick={() => setOpen(false)}
        />

        <div
          className={cn(
            "absolute inset-x-3 top-[4.25rem] bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 sm:inset-x-4 sm:top-[4.75rem]",
            open
              ? "translate-y-0 opacity-100"
              : "-translate-y-3 opacity-0",
          )}
        >
          <div className="scroll-y-touch flex-1 space-y-6 overflow-y-auto px-4 py-5">
            <div>
              <p className="px-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                主要導覽
              </p>
              <div className="mt-2 space-y-1">
                {primaryNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/5"
                  >
                    {item.icon ? (
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-emerald-300 ring-1 ring-white/10">
                        <item.icon className="h-4 w-4" />
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-white">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="px-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                案例與法規
              </p>
              <div className="mt-2 space-y-1">
                {secondaryNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/5"
                  >
                    {item.icon ? (
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-amber-200 ring-1 ring-white/10">
                        <item.icon className="h-4 w-4" />
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-100">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="px-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                帳號
              </p>
              <div className="mt-2 space-y-1">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-3 py-3 text-base font-semibold text-white hover:bg-white/5"
                >
                  登入／進入後台
                </Link>
                <DeveloperOnly>
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-3 py-3 text-base font-medium text-slate-200 hover:bg-white/5"
                  >
                    總管理後台
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-3 py-3 text-base font-medium text-slate-200 hover:bg-white/5"
                  >
                    店家後台
                  </Link>
                </DeveloperOnly>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/80 p-4">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button
                as="span"
                variant="outline"
                className="mb-2 h-12 w-full border-white/20 bg-transparent text-base text-white hover:bg-white/10"
              >
                登入後台
              </Button>
            </Link>
            <LineCtaLink onClick={() => setOpen(false)}>
              <Button
                as="span"
                className="h-12 w-full bg-emerald-500 text-base text-slate-950 hover:bg-emerald-400"
              >
                <MessageCircle className="h-4 w-4" />
                LINE 立即預約諮詢
              </Button>
            </LineCtaLink>
            <Link
              href="/#contact"
              onClick={() => setOpen(false)}
              className="mt-2 block text-center text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              或前往頁面留下諮詢表單
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
