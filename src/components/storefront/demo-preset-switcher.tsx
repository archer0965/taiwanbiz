"use client";

import {
  demoPreviewHref,
  storefrontPresetLabel,
  type DemoPreviewSlug,
  type StorefrontPreset,
} from "@/lib/storefront-preset";
import { cn } from "@/lib/utils";
import Link from "next/link";

const INDUSTRIES: Array<{
  slug: DemoPreviewSlug;
  label: string;
}> = [
  { slug: "nail-studio", label: "美甲預覽" },
  { slug: "hair-salon", label: "美髮預覽" },
];

const PRESETS: StorefrontPreset[] = ["basic", "premium"];

type Props = {
  slug: DemoPreviewSlug;
  preset: StorefrontPreset;
};

/** 示範站頂部：切換美甲／美髮 × 基礎版／旗艦版 */
export function DemoPresetSwitcher({ slug, preset }: Props) {
  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-2.5">
        <p className="hidden text-[11px] font-medium tracking-wide text-slate-400 sm:block">
          示範前台預覽・可切換方案版型
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5"
            role="group"
            aria-label="示範業種"
          >
            {INDUSTRIES.map((item) => {
              const active = item.slug === slug;
              return (
                <Link
                  key={item.slug}
                  href={demoPreviewHref(item.slug, preset)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div
            className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5"
            role="group"
            aria-label="方案版型"
          >
            {PRESETS.map((p) => {
              const active = p === preset;
              return (
                <Link
                  key={p}
                  href={demoPreviewHref(slug, p)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "bg-[color:var(--sf-primary,#fb7185)] text-[color:var(--sf-button-text,#0f172a)]"
                      : "text-slate-300 hover:text-white",
                  )}
                >
                  {p === "basic" ? "基礎版" : "旗艦版"}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <p className="sr-only">
        目前：{slug === "nail-studio" ? "美甲" : "美髮"}・
        {storefrontPresetLabel(preset)}
      </p>
    </div>
  );
}
