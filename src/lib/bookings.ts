/** 預約狀態（賣家日曆／CRM 完成率用） */
export type BookingStatus =
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "pending_deposit";

export type BookingSource = "online" | "manual" | "walk_in";

export type BookingDepositStatus =
  | "none"
  | "pending"
  | "paid"
  | "waived"
  | "reported";

export type BookingRecord = {
  id: string;
  storeSlug: string;
  storeName: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  /** 顧客 LINE userId（若已透過 OA 綁定） */
  customerLineUserId?: string;
  serviceName: string;
  staffName?: string;
  /** ISO 開始時間（Asia/Taipei 語意由呼叫端保證） */
  startsAt: string;
  slotLabel: string;
  /** 本次預約佔用分鐘數（多項目加總後的 duration_minutes） */
  durationMinutes?: number;
  /** 服務原價合計（折扣前） */
  listAmount?: number;
  /** 離峰優惠折抵金額 */
  offPeakDiscountAmount?: number;
  /** 現場應付金額（原價 − 離峰折抵） */
  payAmount?: number;
  /** 是否套用離峰優惠 */
  offPeakApplied?: boolean;
  /** 套用的優惠碼（例：OFFPEAK100） */
  promoCode?: string | null;
  note?: string;
  /** 參考圖片（data URL 或 http(s)，最多 3） */
  referenceImages?: string[];
  /** 行前提醒預定寄送時間 ISO */
  remindAt: string;
  customerSuccessNotifiedAt?: string;
  sellerNotifiedAt?: string;
  reminderSentAt?: string | null;
  /** 課後關心／好評導流已送出 */
  reviewPromptSentAt?: string | null;
  /** 燙染護理回購推播預定時間 ISO */
  careRemindAt?: string | null;
  /** 護理回購推播已送出 */
  careReminderSentAt?: string | null;
  /** 預約狀態；缺省視為 confirmed */
  status?: BookingStatus;
  /** 來源：線上／後台手動／現場客 */
  source?: BookingSource;
  /** 訂金金額 */
  depositAmount?: number;
  /** 訂金狀態 */
  depositStatus?: BookingDepositStatus;
  /** 訂金通路 */
  depositMethod?: "none" | "bank_transfer" | "ecpay";
  depositTradeNo?: string | null;
  depositPaidAt?: string | null;
  /** 顧客回報匯款後五碼 */
  depositBankLastFive?: string | null;
};

export function resolveBookingStatus(b: BookingRecord): BookingStatus {
  return b.status || "confirmed";
}

export function isActiveCalendarBooking(b: BookingRecord) {
  const status = resolveBookingStatus(b);
  return status !== "cancelled";
}

export function createBookingId() {
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** @deprecated 改由 bookings-db.server 持久化；此記憶體表僅作單元測試 fallback */
const g = globalThis as typeof globalThis & {
  __taiwanbizBookings?: BookingRecord[];
};

function memoryStore() {
  if (!g.__taiwanbizBookings) g.__taiwanbizBookings = [];
  return g.__taiwanbizBookings;
}

/** 預設於預約開始前 24 小時提醒；若已過期則立即標記為需提醒 */
export function computeRemindAt(startsAtIso: string, now = new Date()) {
  const starts = new Date(startsAtIso).getTime();
  const remind = starts - 24 * 60 * 60 * 1000;
  if (!Number.isFinite(starts)) return now.toISOString();
  if (remind <= now.getTime()) {
    // 短於 24h 的預約：於開始前 2 小時提醒，否則立即
    const short = starts - 2 * 60 * 60 * 1000;
    return new Date(
      short > now.getTime() ? short : now.getTime(),
    ).toISOString();
  }
  return new Date(remind).toISOString();
}

export function saveBooking(booking: BookingRecord) {
  const list = memoryStore();
  list.unshift(booking);
  if (list.length > 500) list.length = 500;
  return booking;
}

export function listBookingsDueForReminder(now = new Date()) {
  const ts = now.getTime();
  return memoryStore().filter(
    (b) => !b.reminderSentAt && new Date(b.remindAt).getTime() <= ts,
  );
}

export function markBookingReminderSent(id: string, at = new Date()) {
  const hit = memoryStore().find((b) => b.id === id);
  if (!hit) return null;
  hit.reminderSentAt = at.toISOString();
  return hit;
}

export function formatSlotLabel(startsAtIso: string) {
  try {
    return new Date(startsAtIso).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return startsAtIso;
  }
}

/** 預設可預約時段（台北時間） */
export const DEFAULT_BOOKING_SLOT_HOURS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
] as const;

export function listBookingsForStore(storeSlug: string) {
  return memoryStore().filter((b) => b.storeSlug === storeSlug);
}

/** 將 ISO 轉成台北 YYYY-MM-DD + HH:mm */
export function toTaipeiDateAndTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

export function isSlotBooked(
  storeSlug: string,
  dateYmd: string,
  timeHm: string,
  staffName?: string,
) {
  return listBookingsForStore(storeSlug).some((b) => {
    const parts = toTaipeiDateAndTime(b.startsAt);
    if (!parts) return false;
    if (parts.date !== dateYmd || parts.time !== timeHm) return false;
    // 指定同一服務人員才互斥；未指定則整店時段鎖定
    if (!staffName || staffName === "不指定") return true;
    if (!b.staffName) return true;
    return b.staffName === staffName;
  });
}

export function buildSlotAvailability(input: {
  storeSlug: string;
  dateYmd: string;
  staffName?: string;
  slotHours?: readonly string[];
  now?: Date;
}) {
  const hours = input.slotHours || DEFAULT_BOOKING_SLOT_HOURS;
  const now = input.now || new Date();
  return hours.map((time) => {
    const starts = new Date(`${input.dateYmd}T${time}:00+08:00`);
    const past = Number.isNaN(starts.getTime()) || starts.getTime() <= now.getTime();
    const taken = isSlotBooked(
      input.storeSlug,
      input.dateYmd,
      time,
      input.staffName,
    );
    return {
      time,
      disabled: past || taken,
      reason: past ? ("past" as const) : taken ? ("booked" as const) : ("open" as const),
      startsAtLocal: `${input.dateYmd}T${time}`,
    };
  });
}
