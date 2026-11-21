import { ARCHITECTURE } from "@/lib/architecture-constraints";

/** 賣家前台渲染模式 */
export type StorefrontPreset = "basic" | "premium";

const DEMO_PRESET_BY_SLUG: Record<string, StorefrontPreset> = {
  "nail-studio": "basic",
  "hair-salon": "premium",
  "select-shop": "premium",
  "brunch-house": "basic",
};

/** 對外示範站（美甲／美髮），可切換基礎版／旗艦版預覽 */
export const DEMO_PREVIEW_SLUGS = ["nail-studio", "hair-salon"] as const;
export type DemoPreviewSlug = (typeof DEMO_PREVIEW_SLUGS)[number];

export function isDemoPreviewSlug(slug?: string | null): slug is DemoPreviewSlug {
  return DEMO_PREVIEW_SLUGS.includes(String(slug || "") as DemoPreviewSlug);
}

export function parseStorefrontPreset(
  raw?: string | null,
): StorefrontPreset | null {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "basic" || v === "starter" || v === "基礎") return "basic";
  if (
    v === "premium" ||
    v === "flagship" ||
    v === "growth" ||
    v === "旗艦"
  ) {
    return "premium";
  }
  return null;
}

/** 示範前台連結（可指定基礎／旗艦） */
export function demoPreviewHref(
  slug: DemoPreviewSlug,
  preset: StorefrontPreset,
  hash = "booking",
) {
  const path = `/stores/${slug}?preset=${preset}`;
  return hash ? `${path}#${hash}` : path;
}

function hasStarterSignal(planId?: string | null, planName?: string | null) {
  const id = String(planId || "").toLowerCase();
  const name = String(planName || "");
  return (
    id === "starter" ||
    name.includes("基礎") ||
    name.includes("Booking Express")
  );
}

function hasFlagshipSignal(planId?: string | null, planName?: string | null) {
  const id = String(planId || "").toLowerCase();
  const name = String(planName || "");
  return (
    id === "growth" ||
    id === "flagship" ||
    name.includes("旗艦") ||
    name.includes("導流") ||
    name.includes("Brand Flagship")
  );
}

/**
 * 依訂閱方案推導前台 preset：
 * - 基礎版（starter / $299）→ basic 純預約單頁
 * - 旗艦版（growth / $499）→ premium 品牌官網
 * - 無方案資訊時：示範 slug 對照 → 其餘預設 premium（試用完整體驗）
 */
export function resolveStorefrontPreset(input: {
  slug?: string | null;
  planId?: string | null;
  planName?: string | null;
  listAmount?: number | null;
  /** 內容覆寫（選用） */
  override?: StorefrontPreset | null;
}): StorefrontPreset {
  if (input.override === "basic" || input.override === "premium") {
    return input.override;
  }

  if (hasStarterSignal(input.planId, input.planName)) return "basic";
  if (hasFlagshipSignal(input.planId, input.planName)) return "premium";

  const amount = Number(input.listAmount);
  if (
    amount === ARCHITECTURE.plans.starter.monthly ||
    amount === ARCHITECTURE.plans.starter.annual
  ) {
    return "basic";
  }
  if (
    amount === ARCHITECTURE.plans.flagship.monthly ||
    amount === ARCHITECTURE.plans.flagship.annual
  ) {
    return "premium";
  }

  const slug = String(input.slug || "").trim();
  if (slug && DEMO_PRESET_BY_SLUG[slug]) return DEMO_PRESET_BY_SLUG[slug];

  return "premium";
}

export function storefrontPresetLabel(preset: StorefrontPreset) {
  return preset === "basic" ? "基礎版・純預約" : "旗艦版・品牌官網";
}
