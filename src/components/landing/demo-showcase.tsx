"use client";

import { Button } from "@/components/ui/button";
import {
  demoPreviewHref,
  type DemoPreviewSlug,
  type StorefrontPreset,
} from "@/lib/storefront-preset";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Clock3,
  ImagePlus,
  Scissors,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type DemoTab = "nail" | "hair";

const TABS: Array<{
  id: DemoTab;
  label: string;
  slug: DemoPreviewSlug;
  storeName: string;
}> = [
  {
    id: "nail",
    label: "美甲美睫 Demo",
    slug: "nail-studio",
    storeName: "澄光美甲",
  },
  {
    id: "hair",
    label: "美髮沙龍 Demo",
    slug: "hair-salon",
    storeName: "絲光髮廊",
  },
];

export function DemoShowcase() {
  const [tab, setTab] = useState<DemoTab>("nail");
  const active = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <section
      id="demo"
      className="scroll-mt-24 border-y border-[color:var(--lp-line)] bg-[color:var(--lp-surface)] py-16 sm:py-20"
      aria-labelledby="demo-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-[color:var(--lp-accent)] uppercase">
            Interactive Demo
          </p>
          <h2
            id="demo-heading"
            className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[color:var(--lp-ink)] sm:text-4xl"
          >
            先試玩，再申請開店
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[color:var(--lp-muted)]">
            切換美甲／美髮，並分別試玩基礎版與旗艦版前台；上線後即是同一套介面。
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Demo 類型"
          className="mt-8 flex flex-col gap-2 sm:flex-row"
        >
          {TABS.map((item) => {
            const selected = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={cn(
                  "touch-target rounded-2xl px-4 py-3 text-left text-sm font-semibold transition duration-300",
                  selected
                    ? "bg-[color:var(--lp-ink)] text-[color:var(--lp-cream)] shadow-lg shadow-[color:var(--lp-ink)]/15"
                    : "bg-[color:var(--lp-cream)] text-[color:var(--lp-ink)] ring-1 ring-[color:var(--lp-line)] hover:bg-white",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div
            key={tab}
            role="tabpanel"
            className="lp-demo-panel relative overflow-hidden rounded-[1.75rem] bg-[color:var(--lp-cream)] ring-1 ring-[color:var(--lp-line)]"
          >
            {tab === "nail" ? <NailDemoPreview /> : <HairDemoPreview />}
          </div>

          <div className="flex flex-col justify-center">
            <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[color:var(--lp-ink)]">
              {tab === "nail" ? "美甲美睫預約體驗" : "美髮沙龍預約體驗"}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--lp-muted)]">
              {tab === "nail"
                ? "示範單色／造型選擇、卸甲加購延長時段、參考圖上傳與條款勾選——美業工作室最常需要的流程一次齊。"
                : "示範剪髮／燙染切換、210 分鐘連續鎖定，以及平日離峰自動折 $100，讓空檔自己被填滿。"}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[color:var(--lp-ink)]">
              {(tab === "nail"
                ? [
                    "單色／造型服務複選",
                    "卸甲加購 +30 分鐘連動",
                    "參考圖片上傳（最多 3 張）",
                    "預約條款勾選確認",
                  ]
                : [
                    "剪髮／燙染服務選擇",
                    "燙染 210 分鐘連續時段鎖定",
                    "平日離峰自動折扣標籤",
                    "設計師排班防撞期",
                  ]
              ).map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--lp-accent-soft)] text-[color:var(--lp-accent)]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {(
                [
                  ["basic", "基礎版・純預約"],
                  ["premium", "旗艦版・品牌官網"],
                ] as Array<[StorefrontPreset, string]>
              ).map(([preset, label]) => (
                <Link key={preset} href={demoPreviewHref(active.slug, preset)}>
                  <Button
                    as="span"
                    size="lg"
                    variant={preset === "basic" ? "primary" : "outline"}
                    className={cn(
                      "h-12 w-full px-6 text-base sm:w-auto",
                      preset === "basic"
                        ? "bg-[color:var(--lp-accent)] text-white hover:bg-[color:var(--lp-accent-deep)]"
                        : "border-[color:var(--lp-line)] bg-white text-[color:var(--lp-ink)] hover:bg-[color:var(--lp-mist)]",
                    )}
                  >
                    {active.storeName}・{label}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NailDemoPreview() {
  const [solid, setSolid] = useState(true);
  const [art, setArt] = useState(false);
  const [remove, setRemove] = useState(true);
  const [terms, setTerms] = useState(true);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPulse((n) => n + 1), 2800);
    return () => window.clearInterval(id);
  }, []);

  const minutes = (solid ? 75 : 0) + (art ? 105 : 0) + (remove ? 30 : 0);

  return (
    <div className="p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[color:var(--lp-accent)]">
            澄光美甲 · 預約預覽
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--lp-ink)]">
            選擇服務
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--lp-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--lp-accent-deep)]">
          <Clock3 className="h-3.5 w-3.5" />
          {minutes || 0} 分
        </span>
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <ServiceChip
          active={solid}
          title="單色凝膠"
          meta="NT$799 · 75 分"
          onClick={() => setSolid((v) => !v)}
        />
        <ServiceChip
          active={art}
          title="造型彩繪"
          meta="NT$1,099 · 105 分"
          onClick={() => setArt((v) => !v)}
        />
        <ServiceChip
          active={remove}
          title="卸甲加購"
          meta="+$200 · +30 分"
          highlight
          onClick={() => setRemove((v) => !v)}
        />
      </div>

      <div
        className={cn(
          "mt-5 rounded-2xl border border-dashed border-[color:var(--lp-line)] bg-white/70 p-4 transition",
          pulse % 2 === 0 && "lp-soft-glow",
        )}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--lp-ink)]">
          <ImagePlus className="h-4 w-4 text-[color:var(--lp-accent)]" />
          參考圖片上傳
        </div>
        <p className="mt-1 text-xs text-[color:var(--lp-muted)]">
          可上傳美甲／美睫樣式參考圖，方便設計師預先準備。
        </p>
        <div className="mt-3 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-14 w-14 rounded-xl border border-[color:var(--lp-line)] bg-[color:var(--lp-mist)]",
                i === 0 && "bg-gradient-to-br from-[#e8d5cb] to-[#c9a693]",
                i === 1 && "opacity-60",
              )}
            />
          ))}
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-white/80 p-3.5 ring-1 ring-[color:var(--lp-line)]">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[color:var(--lp-accent)]"
        />
        <span className="text-sm leading-relaxed text-[color:var(--lp-muted)]">
          我已閱讀並同意預約條款（遲到／改期規範）
        </span>
      </label>
    </div>
  );
}

function HairDemoPreview() {
  const [service, setService] = useState<"cut" | "perm">("perm");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 3200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[color:var(--lp-accent)]">
            絲光髮廊 · 預約預覽
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--lp-ink)]">
            剪髮／燙染
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--lp-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--lp-accent-deep)]">
          <Scissors className="h-3.5 w-3.5" />
          {service === "perm" ? "210 分鎖定" : "60 分"}
        </span>
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <ServiceChip
          active={service === "cut"}
          title="剪髮造型"
          meta="NT$680 · 60 分"
          onClick={() => setService("cut")}
        />
        <ServiceChip
          active={service === "perm"}
          title="燙染造型"
          meta="NT$4,200 · 210 分"
          onClick={() => setService("perm")}
        />
      </div>

      {service === "perm" ? (
        <div className="lp-demo-lock mt-5 rounded-2xl bg-[color:var(--lp-ink)] px-4 py-3 text-sm text-[color:var(--lp-cream)]">
          <p className="font-semibold">長時段連動已啟用</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            系統將鎖定連續 210 分鐘空檔，避免燙染中途撞期。
          </p>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="text-xs font-semibold tracking-wide text-[color:var(--lp-muted)]">
          可預約時段
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {[
            { t: "11:00", off: false },
            { t: "13:30", off: true },
            { t: "14:00", off: true },
            { t: "15:00", off: true },
            { t: "16:30", off: false },
            { t: "18:00", off: false },
          ].map((slot, i) => (
            <div
              key={slot.t}
              className={cn(
                "relative rounded-xl px-2 py-2.5 text-center text-xs font-semibold ring-1 transition",
                slot.off
                  ? "bg-[#f3ebe3] text-[color:var(--lp-accent-deep)] ring-[#e0cfc0]"
                  : "bg-white text-[color:var(--lp-ink)] ring-[color:var(--lp-line)]",
                tick % 2 === 0 && slot.off && i === 1 && "lp-soft-glow",
              )}
            >
              {slot.t}
              {slot.off ? (
                <span className="mt-1 block text-[10px] font-bold tracking-wide">
                  離峰 -$100
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/80 px-3.5 py-3 text-sm text-[color:var(--lp-ink)] ring-1 ring-[color:var(--lp-line)]">
        <Sparkles className="h-4 w-4 text-[color:var(--lp-accent)]" />
        <span>
          套用優惠碼 <strong>OFFPEAK100 -$100</strong>
        </span>
      </div>
    </div>
  );
}

function ServiceChip({
  active,
  title,
  meta,
  highlight,
  onClick,
}: {
  active: boolean;
  title: string;
  meta: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl px-3.5 py-3 text-left transition duration-300 ring-1",
        active
          ? "bg-[color:var(--lp-ink)] text-[color:var(--lp-cream)] ring-[color:var(--lp-ink)]"
          : "bg-white/80 text-[color:var(--lp-ink)] ring-[color:var(--lp-line)] hover:bg-white",
        highlight && !active && "ring-[color:var(--lp-accent)]/40",
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p
        className={cn(
          "mt-0.5 text-xs",
          active ? "text-white/70" : "text-[color:var(--lp-muted)]",
        )}
      >
        {meta}
      </p>
    </button>
  );
}
