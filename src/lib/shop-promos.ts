export type ShopPromoType = "percent" | "fixed" | "free_shipping";

export type ShopPromo = {
  id: string;
  name: string;
  /** 空白＝僅自動套用／全站活動；有值＝結帳輸入折扣碼 */
  code: string;
  type: ShopPromoType;
  /** percent：1–100；fixed：折抵金額；free_shipping：忽略 */
  value: number;
  minSubtotal: number;
  active: boolean;
  /** 符合條件時結帳自動套用（無需輸入代碼） */
  autoApply: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usedCount?: number;
};

export type AppliedShopPromo = {
  promoId: string;
  promoName: string;
  promoCode: string;
  promoType: ShopPromoType;
  discountAmount: number;
  freeShipping: boolean;
};

export function emptyShopPromo(): ShopPromo {
  return {
    id: `promo-${Date.now()}`,
    name: "新優惠",
    code: "",
    type: "percent",
    value: 10,
    minSubtotal: 0,
    active: true,
    autoApply: true,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usedCount: 0,
  };
}

export function normalizeShopPromo(raw: Partial<ShopPromo>): ShopPromo {
  const type: ShopPromoType =
    raw.type === "fixed" || raw.type === "free_shipping"
      ? raw.type
      : "percent";
  let value = Math.max(0, Math.round(Number(raw.value) || 0));
  if (type === "percent") value = Math.min(100, Math.max(1, value || 10));
  if (type === "fixed") value = Math.max(1, value || 50);
  return {
    id: (raw.id || `promo-${Date.now()}`).trim(),
    name: (raw.name || "優惠活動").trim().slice(0, 40),
    code: (raw.code || "").trim().toUpperCase().slice(0, 24),
    type,
    value: type === "free_shipping" ? 0 : value,
    minSubtotal: Math.max(0, Math.round(Number(raw.minSubtotal) || 0)),
    active: raw.active !== false,
    autoApply: Boolean(raw.autoApply),
    startsAt: raw.startsAt || null,
    endsAt: raw.endsAt || null,
    usageLimit:
      raw.usageLimit == null || Number.isNaN(Number(raw.usageLimit))
        ? null
        : Math.max(1, Math.round(Number(raw.usageLimit))),
    usedCount: Math.max(0, Math.round(Number(raw.usedCount) || 0)),
  };
}

export function normalizeShopPromos(list: unknown): ShopPromo[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => normalizeShopPromo(item as Partial<ShopPromo>));
}

function inDateRange(promo: ShopPromo, now = new Date()) {
  if (promo.startsAt) {
    const start = new Date(promo.startsAt);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (promo.endsAt) {
    const end = new Date(promo.endsAt);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

export function isShopPromoEligible(
  promo: ShopPromo,
  subtotal: number,
  now = new Date(),
) {
  if (!promo.active) return false;
  if (!inDateRange(promo, now)) return false;
  if (subtotal < promo.minSubtotal) return false;
  if (
    promo.usageLimit != null &&
    (promo.usedCount || 0) >= promo.usageLimit
  ) {
    return false;
  }
  return true;
}

export function calcPromoDiscount(promo: ShopPromo, subtotal: number) {
  const base = Math.max(0, Math.round(subtotal));
  if (promo.type === "free_shipping") return 0;
  if (promo.type === "percent") {
    return Math.min(base, Math.round((base * promo.value) / 100));
  }
  return Math.min(base, Math.max(0, Math.round(promo.value)));
}

export function applyShopPromo(
  promos: ShopPromo[],
  subtotal: number,
  codeInput?: string | null,
  now = new Date(),
): AppliedShopPromo | null {
  const code = (codeInput || "").trim().toUpperCase();
  let chosen: ShopPromo | null = null;

  if (code) {
    chosen =
      promos.find(
        (p) =>
          p.code &&
          p.code.toUpperCase() === code &&
          isShopPromoEligible(p, subtotal, now),
      ) || null;
    if (!chosen) return null;
  } else {
    const autos = promos.filter(
      (p) => p.autoApply && isShopPromoEligible(p, subtotal, now),
    );
    if (autos.length === 0) return null;
    // 選折抵金額最高者；免運視為有價值但排在金額折扣之後若同時存在金額更大者
    chosen = autos.reduce((best, cur) => {
      const bestScore =
        best.type === "free_shipping"
          ? 1
          : calcPromoDiscount(best, subtotal) * 10;
      const curScore =
        cur.type === "free_shipping"
          ? 1
          : calcPromoDiscount(cur, subtotal) * 10;
      return curScore > bestScore ? cur : best;
    });
  }

  return {
    promoId: chosen.id,
    promoName: chosen.name,
    promoCode: chosen.code,
    promoType: chosen.type,
    discountAmount: calcPromoDiscount(chosen, subtotal),
    freeShipping: chosen.type === "free_shipping",
  };
}

export function formatShopPromoLabel(promo: ShopPromo) {
  if (promo.type === "free_shipping") return "免運費";
  if (promo.type === "percent") return `${promo.value}% 折扣`;
  return `折抵 NT$${promo.value}`;
}
