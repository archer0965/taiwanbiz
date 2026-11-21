import { DemoShowcase } from "@/components/landing/demo-showcase";
import { FaqSection } from "@/components/landing/faq-section";
import { FoundingPromoFloat } from "@/components/landing/founding-promo-float";
import { InquiryForm } from "@/components/landing/inquiry-form";
import { PricingSection } from "@/components/landing/pricing-section";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import {
  Ban,
  CalendarCheck2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { demoPreviewHref } from "@/lib/storefront-preset";
import Link from "next/link";
import { Suspense } from "react";

const features = [
  {
    icon: CalendarCheck2,
    title: "防撞期排班",
    desc: "依服務時長鎖定連續空檔，燙染 210 分也不會撞班。",
  },
  {
    icon: Ban,
    title: "防放鳥黑名單",
    desc: "常放鳥顧客可一鍵封鎖，減少空班與材料浪費。",
  },
  {
    icon: Sparkles,
    title: "自動離峰填滿",
    desc: "平日空檔自動標示優惠碼折扣，讓離峰時段自己被預約。",
  },
  {
    icon: MessageCircle,
    title: "免設定 LINE 即時通知",
    desc: "預約成功即推播賣家與買家，行前提醒降低放鳥。",
  },
  {
    icon: Wallet,
    title: "先註冊／創始 8 折",
    desc: "先註冊再開通試用；前 15 組 14 天免費後續費 8 折，額滿後 3 天試用。忘記續費可保留網站 30 天。",
  },
];

export default function HomePage() {
  return (
    <div className="lp-beauty">
      <FoundingPromoFloat />
      <SiteHeader />
      <main className="flex-1">
        <section className="relative min-h-[100svh] overflow-hidden text-[color:var(--lp-cream)]">
          <div className="absolute inset-0">
            <SafeImage
              src="https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=2200&q=80"
              alt="美甲美髮工作室預約氛圍"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_35%] scale-105 lp-hero- ken"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2a221c]/92 via-[#3a2f28]/72 to-[#2a221c]/35" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1f1915]/85 via-transparent to-[#2a221c]/40" />
            <div className="absolute inset-0 lp-hero-grain" aria-hidden />
          </div>

          <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-16 pt-36 sm:justify-center sm:px-6 sm:pb-24 sm:pt-40">
            <div className="max-w-2xl">
              <p className="animate-fade-in-up font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.22em] text-[#e8d5c8] uppercase sm:text-base">
                拓脈 · Nova Crest Pulse
              </p>
              <h1 className="animate-fade-in-up-delay mt-5 font-[family-name:var(--font-display)] text-[2.15rem] font-semibold leading-[1.18] tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-[3.35rem]">
                美業與美髮工作室的
                <br />
                極速預約官網
              </h1>
              <p className="animate-fade-in-up-delay-2 mt-5 max-w-xl text-base leading-relaxed text-[#f7efe8] sm:text-lg">
                專為美容美甲與美髮沙龍打造：線上預約、防撞期、離峰自動折扣與
                LINE 即時通知，開店當日即可接單。
              </p>
              <div className="animate-fade-in-up-delay-2 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/#cases">
                  <Button
                    as="span"
                    size="lg"
                    className="h-12 w-full bg-[#c4a090] px-6 text-base text-[#1f1915] hover:bg-[#d4b5a6] sm:w-auto"
                  >
                    體驗美甲／美髮預覽
                  </Button>
                </Link>
                <Link href="/?founding=1#pricing">
                  <Button
                    as="span"
                    size="lg"
                    variant="outline"
                    className="h-12 w-full border-[#e8d5c8]/45 bg-transparent px-6 text-base text-[#f5ebe3] hover:bg-white/10 sm:w-auto"
                  >
                    免費申請創始店家
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <DemoShowcase />

        <section
          id="features"
          className="scroll-mt-24 bg-[color:var(--lp-mist)] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-[color:var(--lp-accent)] uppercase">
                為什麼選拓脈
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[color:var(--lp-ink)] sm:text-4xl">
                美業真正用得到的優勢
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[color:var(--lp-muted)]">
                不做雜訊功能。專注排班、通知與填滿空檔，讓工作室把時間留給客人。
              </p>
            </div>

            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {features.map((item, index) => (
                <div
                  key={item.title}
                  className="lp-feature-item border-t border-[color:var(--lp-line)] pt-5"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <item.icon className="h-5 w-5 text-[color:var(--lp-accent)]" />
                  <h3 className="mt-3 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--lp-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--lp-muted)]">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="cases"
          className="scroll-mt-24 border-y border-[color:var(--lp-line)] bg-[color:var(--lp-cream)] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-[color:var(--lp-accent)] uppercase">
                真實前台
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[color:var(--lp-ink)] sm:text-4xl">
                美甲與美髮，各有基礎／旗艦預覽
              </h2>
              <p className="mt-3 text-base text-[color:var(--lp-muted)]">
                同一業種可對照純預約基礎版與品牌官網旗艦版；上線後即是同一套介面。
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="group relative overflow-hidden rounded-[1.5rem]">
                <div className="relative aspect-[16/11]">
                  <SafeImage
                    src="https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1400&q=80"
                    alt="澄光美甲示範前台"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1f1915]/90 via-[#1f1915]/35 to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <p className="text-xs font-semibold tracking-wide text-[#e8d5c8]">
                    美甲美睫
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                    澄光美甲 Nail Studio
                  </h3>
                  <p className="mt-1 text-sm text-white/75">
                    單色／造型、卸甲加購、參考圖與條款
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={demoPreviewHref("nail-studio", "basic")}
                      className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1f1915] hover:bg-[#e8d5c8]"
                    >
                      基礎版預覽
                    </Link>
                    <Link
                      href={demoPreviewHref("nail-studio", "premium")}
                      className="rounded-full border border-white/35 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                    >
                      旗艦版預覽
                    </Link>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-[1.5rem]">
                <div className="relative aspect-[16/11]">
                  <SafeImage
                    src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80"
                    alt="絲光髮廊示範前台"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1f1915]/90 via-[#1f1915]/35 to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <p className="text-xs font-semibold tracking-wide text-[#e8d5c8]">
                    美髮沙龍
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                    絲光髮廊 Silk Hair
                  </h3>
                  <p className="mt-1 text-sm text-white/75">
                    燙染 210 分鎖定、離峰自動 -$100
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={demoPreviewHref("hair-salon", "basic")}
                      className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1f1915] hover:bg-[#e8d5c8]"
                    >
                      基礎版預覽
                    </Link>
                    <Link
                      href={demoPreviewHref("hair-salon", "premium")}
                      className="rounded-full border border-white/35 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                    >
                      旗艦版預覽
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="trust"
          className="scroll-mt-24 bg-[color:var(--lp-surface)] py-14 sm:py-16"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--lp-accent)]" />
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--lp-ink)] sm:text-2xl">
                  自我經營、綠界線上開通
                </h2>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[color:var(--lp-muted)]">
                  先註冊即可上線；前 15 組創始 14 天試用後 8 折，額滿後 3 天試用。
                </p>
              </div>
            </div>
            <Link href="/#pricing">
              <Button
                as="span"
                size="lg"
                className="h-11 w-full bg-[color:var(--lp-ink)] text-[color:var(--lp-cream)] hover:bg-[#3a312b] sm:w-auto"
              >
                查看創始方案
              </Button>
            </Link>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="mx-auto max-w-6xl px-4 py-16">
              <div className="h-80 animate-pulse rounded-2xl bg-[color:var(--lp-mist)]" />
            </div>
          }
        >
          <PricingSection />
        </Suspense>

        <FaqSection className="border-t border-[color:var(--lp-line)] bg-[color:var(--lp-mist)]" />

        <section id="contact" className="scroll-mt-24 bg-[color:var(--lp-cream)] pb-16 sm:pb-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid overflow-hidden rounded-[1.75rem] bg-[color:var(--lp-ink)] lg:grid-cols-[1.05fr_0.95fr]">
              <div className="px-6 py-10 text-[color:var(--lp-cream)] sm:px-10 sm:py-12">
                <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-[#c4a090] uppercase">
                  開始開店
                </p>
                <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                  免費申請創始店家，或留下需求由我們協助
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/65 sm:text-base">
                  美甲、美睫、沙龍與個人工作室皆可。試用期全功能可用，正式訂閱採綠界線上付款。
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/?founding=1#pricing">
                    <Button
                      as="span"
                      className="w-full bg-[#c4a090] text-[#1f1915] hover:bg-[#d4b5a6] sm:w-auto"
                    >
                      免費申請創始店家
                    </Button>
                  </Link>
                  <Link href="/#cases">
                    <Button
                      as="span"
                      variant="outline"
                      className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 sm:w-auto"
                    >
                      先看基礎／旗艦預覽
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="bg-[#2f2823] px-6 py-10 sm:px-10 sm:py-12">
                <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--lp-cream)]">
                  留下需求
                </h3>
                <p className="mt-1 text-sm text-white/55">
                  請留下 LINE ID，我們會以此與您確認開店細節。
                </p>
                <div className="mt-6">
                  <Suspense
                    fallback={
                      <div className="h-64 animate-pulse rounded-xl bg-white/5" />
                    }
                  >
                    <InquiryForm />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
