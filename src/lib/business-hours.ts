export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type DayHours = {
  open: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
};

export type BusinessHoursSettings = {
  week: Record<WeekdayKey, DayHours>;
  /** 全局預約間隔（分鐘） */
  bufferTimeMinutes: number;
  /** 特別休假／手動鎖定日期 YYYY-MM-DD */
  blockedDates: string[];
  /** 手動鎖定的具體時段（台北） */
  blockedSlots: Array<{ date: string; time: string }>;
  /**
   * 是否啟用每日預約組數上限
   * false＝不限制；true 時以 maxDailyBookings（max_daily_bookings）為上限
   */
  maxDailyBookingsEnabled: boolean;
  /** 每日最多接待組數（max_daily_bookings），預設 4 */
  maxDailyBookings: number;
};

export const WEEKDAY_KEYS: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "週一",
  tue: "週二",
  wed: "週三",
  thu: "週四",
  fri: "週五",
  sat: "週六",
  sun: "週日",
};

export function defaultBusinessHours(): BusinessHoursSettings {
  const day = (open: boolean): DayHours => ({
    open,
    start: "10:00",
    end: "20:00",
  });
  return {
    week: {
      mon: day(true),
      tue: day(true),
      wed: day(true),
      thu: day(true),
      fri: day(true),
      sat: day(true),
      sun: day(false),
    },
    bufferTimeMinutes: 15,
    blockedDates: [],
    blockedSlots: [],
    maxDailyBookingsEnabled: false,
    maxDailyBookings: 4,
  };
}

export function normalizeBusinessHours(
  raw?: Partial<BusinessHoursSettings> | null,
): BusinessHoursSettings {
  const base = defaultBusinessHours();
  if (!raw) return base;
  const week = { ...base.week };
  for (const key of WEEKDAY_KEYS) {
    const hit = raw.week?.[key];
    if (!hit) continue;
    week[key] = {
      open: Boolean(hit.open),
      start: hit.start || "10:00",
      end: hit.end || "20:00",
    };
  }
  return {
    week,
    bufferTimeMinutes: Math.max(
      0,
      Math.min(120, Math.floor(Number(raw.bufferTimeMinutes) || 15)),
    ),
    blockedDates: Array.isArray(raw.blockedDates)
      ? [...new Set(raw.blockedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))]
      : [],
    blockedSlots: Array.isArray(raw.blockedSlots)
      ? raw.blockedSlots
          .filter(
            (s) =>
              s &&
              /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
              /^\d{2}:\d{2}$/.test(s.time),
          )
          .map((s) => ({ date: s.date, time: s.time }))
      : [],
    maxDailyBookingsEnabled: Boolean(raw.maxDailyBookingsEnabled),
    maxDailyBookings: Math.max(
      1,
      Math.min(50, Math.floor(Number(raw.maxDailyBookings) || 4)),
    ),
  };
}

export function weekdayKeyFromYmd(dateYmd: string): WeekdayKey {
  // 以台北正午判斷星期，避免 DST／時區偏移
  const d = new Date(`${dateYmd}T12:00:00+08:00`);
  const js = d.getUTCDay(); // 0=Sun
  const map: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[js] || "mon";
}

export function parseHm(hm: string) {
  const [h, m] = hm.split(":").map((n) => Number(n));
  return (h || 0) * 60 + (m || 0);
}

export function formatHm(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 產生當日可開的整點／半點時段起點（不含結束後） */
export function listCandidateSlotStarts(
  hours: BusinessHoursSettings,
  dateYmd: string,
  stepMinutes = 60,
) {
  if (hours.blockedDates.includes(dateYmd)) return [] as string[];
  const key = weekdayKeyFromYmd(dateYmd);
  const day = hours.week[key];
  if (!day?.open) return [] as string[];
  const start = parseHm(day.start);
  const end = parseHm(day.end);
  const out: string[] = [];
  for (let t = start; t < end; t += stepMinutes) {
    out.push(formatHm(t));
  }
  return out;
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && bStart < aEnd;
}

export function bookingOccupiedRangeMinutes(
  startsAtHm: string,
  durationMinutes: number,
  bufferMinutes: number,
) {
  const start = parseHm(startsAtHm);
  const end = start + Math.max(15, durationMinutes) + Math.max(0, bufferMinutes);
  return { start, end };
}

/** 服務時長夾在 15～480 分鐘（支援美髮燙染等長時程） */
export function clampDurationMinutes(raw: unknown, fallback = 60) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(15, Math.min(480, n));
}

/**
 * 連續時段是否能在當日營業結束前完成（不含緩衝）。
 * 長時程（如 210 分燙染）若起點太晚會回 false，避免撞打烊。
 */
export function serviceFitsWithinOpeningHours(
  hours: BusinessHoursSettings,
  dateYmd: string,
  startHm: string,
  durationMinutes: number,
) {
  const key = weekdayKeyFromYmd(dateYmd);
  const day = hours.week[key];
  if (!day?.open) return false;
  const start = parseHm(startHm);
  const dayStart = parseHm(day.start);
  const dayEnd = parseHm(day.end);
  if (start < dayStart) return false;
  const serviceEnd = start + Math.max(15, durationMinutes);
  return serviceEnd <= dayEnd;
}

/**
 * 依多個服務項目加總 duration_minutes（同名以商品設定為準）。
 */
export function sumServicesDurationMinutes(
  products: Array<{ name?: string; durationMinutes?: number }> | undefined,
  serviceNames: string[],
) {
  const names = [
    ...new Set(
      serviceNames
        .map((n) => String(n || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!names.length) return 60;
  const list = products || [];
  let total = 0;
  for (const name of names) {
    const hit = list.find((p) => p.name === name);
    total += clampDurationMinutes(hit?.durationMinutes, 60);
  }
  return Math.max(15, Math.min(12 * 60, total));
}
