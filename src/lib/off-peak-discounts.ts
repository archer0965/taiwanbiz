import {
  WEEKDAY_KEYS,
  parseHm,
  weekdayKeyFromYmd,
  type WeekdayKey,
} from "@/lib/business-hours";

/** 離峰自動優惠設定 */
export type OffPeakDiscountSettings = {
  enabled: boolean;
  /** 適用星期（例：tue–thu） */
  weekdays: WeekdayKey[];
  /** 離峰開始 HH:mm（含） */
  start: string;
  /** 離峰結束 HH:mm（不含） */
  end: string;
  /** fixed＝固定折抵；percent＝折扣比例（九折＝ percentOff 10） */
  mode: "fixed" | "percent";
  /** 固定折抵金額（NT$） */
  fixedAmount: number;
  /** 折扣百分比（10＝九折／現折 10%） */
  percentOff: number;
  /**
   * 優惠碼顯示名稱（通知／訂單用）
   * 例：OFFPEAK100；空白時依金額自動產生
   */
  promoCode: string;
};

export type OffPeakQuote = {
  applied: boolean;
  listAmount: number;
  discountAmount: number;
  payAmount: number;
  /** 優惠碼，例 OFFPEAK100 */
  promoCode: string;
  label: string;
  detail: string;
};

/** 依設定推導預設優惠碼（例：OFFPEAK100／OFFPEAK10PCT） */
export function deriveOffPeakPromoCode(
  settings: Pick<OffPeakDiscountSettings, "mode" | "fixedAmount" | "percentOff" | "promoCode">,
) {
  const custom = String(settings.promoCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
  if (custom) return custom;
  if (settings.mode === "percent") {
    return `OFFPEAK${Math.max(1, settings.percentOff)}PCT`;
  }
  return `OFFPEAK${Math.max(0, settings.fixedAmount)}`;
}

export function defaultOffPeakDiscount(): OffPeakDiscountSettings {
  return {
    enabled: false,
    weekdays: ["tue", "wed", "thu"],
    start: "13:00",
    end: "16:00",
    mode: "fixed",
    fixedAmount: 100,
    percentOff: 10,
    promoCode: "OFFPEAK100",
  };
}

export function normalizeOffPeakDiscount(
  raw?: Partial<OffPeakDiscountSettings> | null,
): OffPeakDiscountSettings {
  const base = defaultOffPeakDiscount();
  if (!raw) return base;
  const weekdays = Array.isArray(raw.weekdays)
    ? ([...new Set(raw.weekdays.filter((d) => WEEKDAY_KEYS.includes(d)))] as WeekdayKey[])
    : base.weekdays;
  return {
    enabled: Boolean(raw.enabled),
    weekdays: weekdays.length ? weekdays : base.weekdays,
    start: /^\d{2}:\d{2}$/.test(String(raw.start || ""))
      ? String(raw.start)
      : base.start,
    end: /^\d{2}:\d{2}$/.test(String(raw.end || ""))
      ? String(raw.end)
      : base.end,
    mode: raw.mode === "percent" ? "percent" : "fixed",
    fixedAmount: Math.max(
      0,
      Math.min(50000, Math.round(Number(raw.fixedAmount) || 0)),
    ),
    percentOff: Math.max(
      1,
      Math.min(90, Math.round(Number(raw.percentOff) || 10)),
    ),
    promoCode: String(raw.promoCode || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 24),
  };
}

/** 預約開始時間是否落在離峰區間 */
export function isOffPeakSlot(
  settings: OffPeakDiscountSettings | null | undefined,
  dateYmd: string,
  timeHm: string,
) {
  const cfg = normalizeOffPeakDiscount(settings);
  if (!cfg.enabled) return false;
  const key = weekdayKeyFromYmd(dateYmd);
  if (!cfg.weekdays.includes(key)) return false;
  const t = parseHm(timeHm);
  const start = parseHm(cfg.start);
  const end = parseHm(cfg.end);
  if (end <= start) return false;
  return t >= start && t < end;
}

/** 依原價計算離峰折扣與現場應付 */
export function quoteOffPeakDiscount(
  settings: OffPeakDiscountSettings | null | undefined,
  listAmountRaw: number,
  dateYmd: string,
  timeHm: string,
): OffPeakQuote {
  const listAmount = Math.max(0, Math.round(Number(listAmountRaw) || 0));
  const cfg = normalizeOffPeakDiscount(settings);
  if (!isOffPeakSlot(cfg, dateYmd, timeHm) || listAmount <= 0) {
    return {
      applied: false,
      listAmount,
      discountAmount: 0,
      payAmount: listAmount,
      promoCode: "",
      label: "",
      detail: "",
    };
  }
  let discountAmount = 0;
  if (cfg.mode === "percent") {
    discountAmount = Math.round((listAmount * cfg.percentOff) / 100);
  } else {
    discountAmount = cfg.fixedAmount;
  }
  discountAmount = Math.max(0, Math.min(listAmount, discountAmount));
  const payAmount = Math.max(0, listAmount - discountAmount);
  const promoCode = deriveOffPeakPromoCode(cfg);
  const discountText = `-$${discountAmount.toLocaleString("en-US")}`;
  const label =
    discountAmount > 0
      ? `🔥 離峰優惠現折 $${discountAmount.toLocaleString("en-US")}`
      : "";
  const detail =
    discountAmount > 0
      ? `套用優惠碼 (${promoCode} ${discountText})｜現場應付 NT$ ${payAmount.toLocaleString("en-US")}`
      : "";
  return {
    applied: discountAmount > 0,
    listAmount,
    discountAmount,
    payAmount,
    promoCode,
    label,
    detail,
  };
}

/** LINE／Email／後台共用的折扣明細行 */
export function formatBookingDiscountLines(booking: {
  listAmount?: number | null;
  payAmount?: number | null;
  offPeakDiscountAmount?: number | null;
  offPeakApplied?: boolean | null;
  promoCode?: string | null;
  discountCode?: string | null;
}) {
  const lines: string[] = [];
  const listAmount = Number(booking.listAmount) || 0;
  const discountAmount = Number(booking.offPeakDiscountAmount) || 0;
  const payAmount =
    typeof booking.payAmount === "number"
      ? booking.payAmount
      : Math.max(0, listAmount - discountAmount);
  const code = String(
    booking.promoCode || booking.discountCode || "",
  )
    .trim()
    .toUpperCase();

  if (listAmount > 0) {
    lines.push(`原價金額：NT$ ${listAmount.toLocaleString("en-US")}`);
  }
  if (booking.offPeakApplied && discountAmount > 0) {
    lines.push(
      code
        ? `套用優惠碼 (${code} -$${discountAmount.toLocaleString("en-US")})`
        : `套用離峰優惠 -$${discountAmount.toLocaleString("en-US")}`,
    );
  }
  if (listAmount > 0 || typeof booking.payAmount === "number") {
    lines.push(
      `最終現場應付金額：NT$ ${Math.max(0, payAmount).toLocaleString("en-US")}`,
    );
  }
  return lines;
}

/** 多服務項目原價加總 */
export function sumServicesListAmount(
  products: Array<{ name?: string; price?: number }> | undefined,
  serviceNames: string[],
) {
  const names = [
    ...new Set(
      serviceNames
        .map((n) => String(n || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!names.length) return 0;
  const list = products || [];
  let total = 0;
  for (const name of names) {
    const hit = list.find((p) => p.name === name);
    total += Math.max(0, Math.round(Number(hit?.price) || 0));
  }
  return total;
}
