/**
 * 賣家前台風格自訂（網站風格工作室）
 * 存於 store content.storeStyle；前台以 CSS 變數套用
 */

export type StoreStylePalette =
  | "rose"
  | "amber"
  | "emerald"
  | "violet"
  | "sky"
  | "stone"
  | "coral";

export type StoreStyleMood =
  | "warm"
  | "cool"
  | "soft"
  | "bold"
  | "minimal";

export type StoreStyleFont = "elegant" | "modern" | "rounded" | "classic";

export type StoreStyleRadius = "soft" | "pill" | "sharp";

export type StoreStyleSettings = {
  palette: StoreStylePalette;
  mood: StoreStyleMood;
  font: StoreStyleFont;
  radius: StoreStyleRadius;
  /** Hero 遮罩濃度 0–80 */
  heroOverlay: number;
  /** 可選自訂主色（#RRGGBB）；空則用 palette */
  customPrimary: string | null;
};

export const STORE_STYLE_PALETTE_LABELS: Record<StoreStylePalette, string> = {
  rose: "玫瑰粉",
  amber: "琥珀金",
  emerald: "森綠",
  violet: "薰衣草紫",
  sky: "天空藍",
  stone: "岩石灰",
  coral: "珊瑚橘",
};

export const STORE_STYLE_MOOD_LABELS: Record<StoreStyleMood, string> = {
  warm: "溫暖光暈",
  cool: "清冷霧感",
  soft: "柔和霧面",
  bold: "高對比鮮明",
  minimal: "極簡留白",
};

export const STORE_STYLE_FONT_LABELS: Record<StoreStyleFont, string> = {
  elegant: "優雅襯線",
  modern: "現代無襯線",
  rounded: "圓潤親和",
  classic: "經典書報",
};

export const STORE_STYLE_RADIUS_LABELS: Record<StoreStyleRadius, string> = {
  soft: "柔和圓角",
  pill: "膠囊圓角",
  sharp: "俐落直角",
};

type PaletteTokens = {
  primary: string;
  primaryDeep: string;
  soft: string;
  text: string;
  glow: string;
  buttonText: string;
};

const PALETTES: Record<StoreStylePalette, PaletteTokens> = {
  rose: {
    primary: "#fb7185",
    primaryDeep: "#e11d48",
    soft: "rgba(251,113,133,0.14)",
    text: "#fda4af",
    glow: "rgba(244,63,94,0.28)",
    buttonText: "#0f172a",
  },
  amber: {
    primary: "#f59e0b",
    primaryDeep: "#d97706",
    soft: "rgba(245,158,11,0.14)",
    text: "#fcd34d",
    glow: "rgba(245,158,11,0.28)",
    buttonText: "#0f172a",
  },
  emerald: {
    primary: "#34d399",
    primaryDeep: "#059669",
    soft: "rgba(52,211,153,0.14)",
    text: "#6ee7b7",
    glow: "rgba(16,185,129,0.25)",
    buttonText: "#0f172a",
  },
  violet: {
    primary: "#a78bfa",
    primaryDeep: "#7c3aed",
    soft: "rgba(167,139,250,0.16)",
    text: "#c4b5fd",
    glow: "rgba(139,92,246,0.28)",
    buttonText: "#0f172a",
  },
  sky: {
    primary: "#38bdf8",
    primaryDeep: "#0284c7",
    soft: "rgba(56,189,248,0.14)",
    text: "#7dd3fc",
    glow: "rgba(14,165,233,0.26)",
    buttonText: "#0f172a",
  },
  stone: {
    primary: "#a8a29e",
    primaryDeep: "#57534e",
    soft: "rgba(168,162,158,0.16)",
    text: "#d6d3d1",
    glow: "rgba(120,113,108,0.22)",
    buttonText: "#0f172a",
  },
  coral: {
    primary: "#fb923c",
    primaryDeep: "#ea580c",
    soft: "rgba(251,146,60,0.14)",
    text: "#fdba74",
    glow: "rgba(249,115,22,0.26)",
    buttonText: "#0f172a",
  },
};

/** 對應 layout.tsx 已載入的 next/font CSS 變數，避免未下載字型造成錯位／回退跳動 */
const FONT_STACKS: Record<StoreStyleFont, string> = {
  elegant:
    'var(--font-cormorant), "Noto Serif TC", "Songti TC", "Times New Roman", serif',
  modern:
    'var(--font-noto-sans-tc), "Noto Sans TC", "PingFang TC", "Helvetica Neue", sans-serif',
  rounded:
    'var(--font-outfit), var(--font-noto-sans-tc), "Noto Sans TC", "PingFang TC", sans-serif',
  classic:
    'var(--font-cormorant), "Noto Serif TC", Georgia, "Songti TC", serif',
};

export function defaultStoreStyle(
  accent?: "emerald" | "rose" | "amber" | string | null,
): StoreStyleSettings {
  const palette: StoreStylePalette =
    accent === "rose"
      ? "rose"
      : accent === "amber"
        ? "amber"
        : accent === "emerald"
          ? "emerald"
          : "rose";
  return {
    palette,
    mood: "soft",
    font: "modern",
    radius: "soft",
    heroOverlay: 45,
    customPrimary: null,
  };
}

function isPalette(v: unknown): v is StoreStylePalette {
  return typeof v === "string" && v in STORE_STYLE_PALETTE_LABELS;
}
function isMood(v: unknown): v is StoreStyleMood {
  return typeof v === "string" && v in STORE_STYLE_MOOD_LABELS;
}
function isFont(v: unknown): v is StoreStyleFont {
  return typeof v === "string" && v in STORE_STYLE_FONT_LABELS;
}
function isRadius(v: unknown): v is StoreStyleRadius {
  return typeof v === "string" && v in STORE_STYLE_RADIUS_LABELS;
}

export function normalizeStoreStyle(
  raw?: Partial<StoreStyleSettings> | null,
  accentFallback?: string | null,
): StoreStyleSettings {
  const base = defaultStoreStyle(accentFallback);
  if (!raw) return base;
  const custom = String(raw.customPrimary || "")
    .trim()
    .match(/^#([0-9a-fA-F]{6})$/)
    ? String(raw.customPrimary).trim().toLowerCase()
    : null;
  return {
    palette: isPalette(raw.palette) ? raw.palette : base.palette,
    mood: isMood(raw.mood) ? raw.mood : base.mood,
    font: isFont(raw.font) ? raw.font : base.font,
    radius: isRadius(raw.radius) ? raw.radius : base.radius,
    heroOverlay: Math.max(
      0,
      Math.min(80, Math.round(Number(raw.heroOverlay) || base.heroOverlay)),
    ),
    customPrimary: custom,
  };
}

/** 風格對應舊 theme（nail/brunch/shop）以相容現有元件 */
export function storeStyleToTheme(
  style: StoreStyleSettings,
): "nail" | "brunch" | "shop" {
  if (style.palette === "rose" || style.palette === "coral") return "nail";
  if (style.palette === "amber") return "brunch";
  if (style.palette === "emerald" || style.palette === "sky") return "brunch";
  if (style.palette === "violet") return "nail";
  return "shop";
}

export function storeStyleToAccent(
  style: StoreStyleSettings,
): "emerald" | "rose" | "amber" {
  if (style.palette === "rose" || style.palette === "coral" || style.palette === "violet") {
    return "rose";
  }
  if (style.palette === "amber") return "amber";
  return "emerald";
}

function moodBackground(mood: StoreStyleMood): string {
  switch (mood) {
    case "warm":
      return "radial-gradient(ellipse at top, rgba(251,191,36,0.18), transparent 55%), #020617";
    case "cool":
      return "radial-gradient(ellipse at top, rgba(56,189,248,0.16), transparent 55%), #020617";
    case "soft":
      return "radial-gradient(ellipse at top, rgba(255,255,255,0.08), transparent 50%), #020617";
    case "bold":
      return "radial-gradient(ellipse at top, rgba(255,255,255,0.12), transparent 45%), #000000";
    case "minimal":
      return "linear-gradient(180deg, #0b1220 0%, #020617 100%)";
    default:
      return "#020617";
  }
}

function radiusPx(radius: StoreStyleRadius): string {
  if (radius === "pill") return "9999px";
  if (radius === "sharp") return "0.5rem";
  return "1.25rem";
}

/** 產生可掛在 style={} 的 CSS 變數 */
export function storeStyleCssVars(
  raw?: Partial<StoreStyleSettings> | null,
  accentFallback?: string | null,
): Record<string, string> {
  const style = normalizeStoreStyle(raw, accentFallback);
  const tokens = { ...PALETTES[style.palette] };
  if (style.customPrimary) {
    tokens.primary = style.customPrimary;
    tokens.primaryDeep = style.customPrimary;
    tokens.text = style.customPrimary;
    tokens.soft = `${style.customPrimary}24`;
    tokens.glow = `${style.customPrimary}40`;
  }
  return {
    ["--sf-primary"]: tokens.primary,
    ["--sf-primary-deep"]: tokens.primaryDeep,
    ["--sf-primary-soft"]: tokens.soft,
    ["--sf-accent-text"]: tokens.text,
    ["--sf-glow"]: tokens.glow,
    ["--sf-button-text"]: tokens.buttonText,
    ["--sf-font"]: FONT_STACKS[style.font],
    ["--sf-radius"]: radiusPx(style.radius),
    ["--sf-hero-overlay"]: String(style.heroOverlay / 100),
    ["--sf-page-bg"]: moodBackground(style.mood),
  };
}

/** 預覽色票 */
export function paletteSwatch(palette: StoreStylePalette): string {
  return PALETTES[palette].primary;
}
