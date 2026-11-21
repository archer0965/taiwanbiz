/** 美業營運保護與熟客維護：條款、黑名單、人員、CRM、課後好評 */

import type { DayHours, WeekdayKey } from "@/lib/business-hours";
import {
  WEEKDAY_KEYS,
  parseHm,
  weekdayKeyFromYmd,
} from "@/lib/business-hours";

export const DEFAULT_BOOKING_TERMS = `【預約與取消須知】
1. 遲到超過 15 分鐘，店家得視為自動取消或縮短服務內容，恕不另行補償。
2. 請於預約日前一天透過 LINE／電話告知改期或取消。
3. 本工作室為預約制，不開放攜帶寵物與訪客久候。
4. 服務現場收費；線上預約僅保留時段，不代表已完成付款。
5. 若有皮膚過敏、孕期或特殊需求，請於備註欄事先告知。`;

export type StoreStaffMember = {
  id: string;
  name: string;
  /** 可選：接單 LINE userId */
  lineUserId?: string;
  /** 是否為預設「店長／賣家本人」 */
  isOwner?: boolean;
  active?: boolean;
  /** stylist＝設計師（可獨立排班） */
  role?: "stylist" | "assistant";
  /**
   * true／未設定＝沿用店家營業時間；
   * false＝使用 week 個別排班
   */
  useStoreHours?: boolean;
  /** 設計師個別週排班（僅 useStoreHours=false 時生效） */
  week?: Partial<Record<WeekdayKey, DayHours>>;
};

/** 燙染後自動回護理推播設定 */
export type CareRetargetingSettings = {
  enabled: boolean;
  /** 預約完成後幾天推播，預設 30 */
  daysAfter: number;
  /** LINE／Email 文案（可含 {store} {service} {bookingUrl}） */
  message?: string;
};

export function defaultCareRetargeting(): CareRetargetingSettings {
  return {
    enabled: true,
    daysAfter: 30,
    message:
      "【護理回購提醒】親愛的 {name}，距離您上次「{service}」已約一個月～現在正是保養護理的好時機！點此重新預約：{bookingUrl}",
  };
}

export function normalizeCareRetargeting(
  raw?: Partial<CareRetargetingSettings> | null,
): CareRetargetingSettings {
  const base = defaultCareRetargeting();
  if (!raw) return base;
  return {
    enabled: raw.enabled !== false,
    daysAfter: Math.max(
      1,
      Math.min(180, Math.round(Number(raw.daysAfter) || 30)),
    ),
    message: String(raw.message || base.message || "").slice(0, 500),
  };
}

/**
 * blacklists 資料表列（存在店家 content.blacklists）
 * 可依 phone / email / user_id 任一鍵攔截前台預約
 */
export type StoreBlacklistEntry = {
  id: string;
  phone?: string;
  email?: string;
  /** LINE／平台 user_id */
  userId?: string;
  reason?: string;
  createdAt: string;
  /** 來源預約編號（若由訂單加入） */
  sourceBookingId?: string;
};

export type StoreCustomerCrm = {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  /** 儲值餘額（元）＝ store_credit */
  storeCredit: number;
  /** 包套／票券備註＝ package_notes */
  packageNotes: string;
  /** 髮況紀錄／漂髮歷史＝ hair_notes */
  hairNotes?: string;
  /** 染劑配方＝ color_recipe */
  colorRecipe?: string;
  /** 偏好備註（過敏／指定設計師／溝通偏好等） */
  preferenceNotes?: string;
  /** 累計預約次數 */
  bookingCount?: number;
  /** 已完成次數 */
  completedCount?: number;
  /** 取消次數 */
  cancelledCount?: number;
  /** 放鳥／未到次數 */
  noShowCount?: number;
  /** 最近一次預約 ISO */
  lastBookingAt?: string;
  updatedAt: string;
  /** 編輯歷史（儲值／包套異動） */
  history?: Array<{
    at: string;
    note: string;
    storeCredit?: number;
    packageNotes?: string;
    hairNotes?: string;
    colorRecipe?: string;
  }>;
};

/** API／報表用 snake_case 視圖 */
export type CustomerCrmRow = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  store_credit: number;
  package_notes: string;
  hair_notes: string;
  color_recipe: string;
  preference_notes: string;
  booking_count: number;
  completed_count: number;
  cancelled_count: number;
  no_show_count: number;
  completion_rate: number;
  last_booking_at: string | null;
  updated_at: string;
  history: NonNullable<StoreCustomerCrm["history"]>;
};

export function customerCompletionRate(c: StoreCustomerCrm) {
  const done = Number(c.completedCount) || 0;
  const noShow = Number(c.noShowCount) || 0;
  const cancelled = Number(c.cancelledCount) || 0;
  const denom = done + noShow + cancelled;
  if (denom <= 0) {
    const total = Number(c.bookingCount) || 0;
    return total > 0 ? 100 : 0;
  }
  return Math.round((done / denom) * 100);
}

export function toCustomerCrmRow(c: StoreCustomerCrm): CustomerCrmRow {
  return {
    id: c.id,
    phone: c.phone,
    email: c.email || null,
    name: c.name || null,
    store_credit: c.storeCredit,
    package_notes: c.packageNotes,
    hair_notes: c.hairNotes || "",
    color_recipe: c.colorRecipe || "",
    preference_notes: c.preferenceNotes || "",
    booking_count: Number(c.bookingCount) || 0,
    completed_count: Number(c.completedCount) || 0,
    cancelled_count: Number(c.cancelledCount) || 0,
    no_show_count: Number(c.noShowCount) || 0,
    completion_rate: customerCompletionRate(c),
    last_booking_at: c.lastBookingAt || null,
    updated_at: c.updatedAt,
    history: c.history || [],
  };
}

export function defaultStaffMembers(): StoreStaffMember[] {
  return [
    {
      id: "staff-owner",
      name: "店長／本人",
      isOwner: true,
      active: true,
      role: "stylist",
      useStoreHours: true,
    },
  ];
}

function normalizeStaffWeek(
  week?: Partial<Record<WeekdayKey, DayHours>> | null,
): Partial<Record<WeekdayKey, DayHours>> | undefined {
  if (!week || typeof week !== "object") return undefined;
  const out: Partial<Record<WeekdayKey, DayHours>> = {};
  for (const key of WEEKDAY_KEYS) {
    const hit = week[key];
    if (!hit) continue;
    out[key] = {
      open: Boolean(hit.open),
      start: hit.start || "10:00",
      end: hit.end || "20:00",
    };
  }
  return Object.keys(out).length ? out : undefined;
}

export function normalizeStaffMembers(
  list?: StoreStaffMember[] | null,
): StoreStaffMember[] {
  if (!Array.isArray(list) || list.length === 0) return defaultStaffMembers();
  const mapped: StoreStaffMember[] = list
    .map((s) => ({
      id: String(s.id || `staff-${Date.now()}`).slice(0, 40),
      name: String(s.name || "").trim().slice(0, 40),
      lineUserId: s.lineUserId?.trim().slice(0, 80) || undefined,
      isOwner: Boolean(s.isOwner),
      active: s.active !== false,
      role: s.role === "assistant" ? ("assistant" as const) : ("stylist" as const),
      useStoreHours: s.useStoreHours !== false,
      week: normalizeStaffWeek(s.week),
    }))
    .filter((s) => s.name);
  // 確保至少有一位店長／本人
  if (!mapped.some((s) => s.isOwner)) {
    mapped.unshift(...defaultStaffMembers());
  }
  // 店長排最前
  return mapped.sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
}

/** 解析設計師當日班表（個別排班或沿用店家） */
export function resolveStylistDayHours(
  staff: StoreStaffMember | null | undefined,
  storeWeek: Record<WeekdayKey, DayHours>,
  dateYmd: string,
): DayHours | null {
  const key = weekdayKeyFromYmd(dateYmd);
  if (!staff || staff.useStoreHours !== false) {
    return storeWeek[key] || null;
  }
  return staff.week?.[key] || storeWeek[key] || null;
}

/** 指定設計師當日此時段＋時長是否在其班表內 */
export function stylistAcceptsSlot(input: {
  staff: StoreStaffMember | null | undefined;
  storeWeek: Record<WeekdayKey, DayHours>;
  dateYmd: string;
  startHm: string;
  durationMinutes: number;
}) {
  const day = resolveStylistDayHours(
    input.staff,
    input.storeWeek,
    input.dateYmd,
  );
  if (!day?.open) return false;
  const start = parseHm(input.startHm);
  const end = start + Math.max(15, input.durationMinutes);
  const dayStart = parseHm(day.start);
  const dayEnd = parseHm(day.end);
  return start >= dayStart && end <= dayEnd;
}

export function staffNameOptions(list?: StoreStaffMember[] | null) {
  const names = normalizeStaffMembers(list)
    .filter((s) => s.active !== false)
    .map((s) => s.name);
  return ["不指定", ...names];
}

/** 前台預設選取：店長／賣家本人 */
export function defaultStaffSelection(list?: StoreStaffMember[] | null) {
  const staff = normalizeStaffMembers(list).filter((s) => s.active !== false);
  const owner = staff.find((s) => s.isOwner) || staff[0];
  return owner?.name || "店長／本人";
}

export function normalizeBlacklists(
  list?: StoreBlacklistEntry[] | null,
): StoreBlacklistEntry[] {
  if (!Array.isArray(list)) return [];
  return list.map((b) => ({
    id: String(b.id || `bl-${Date.now()}`).slice(0, 40),
    phone: b.phone?.replace(/\D/g, "").slice(0, 20) || undefined,
    email: b.email?.trim().toLowerCase().slice(0, 120) || undefined,
    userId: b.userId?.trim().slice(0, 80) || undefined,
    reason: b.reason?.trim().slice(0, 200) || undefined,
    createdAt: b.createdAt || new Date().toISOString(),
    sourceBookingId: b.sourceBookingId?.trim().slice(0, 40) || undefined,
  }));
}

export function isBlacklisted(input: {
  phone?: string;
  email?: string;
  userId?: string;
  list?: StoreBlacklistEntry[] | null;
}) {
  const list = normalizeBlacklists(input.list);
  const phone = (input.phone || "").replace(/\D/g, "");
  const email = (input.email || "").trim().toLowerCase();
  const userId = (input.userId || "").trim();
  return list.some((b) => {
    if (phone && b.phone && b.phone === phone) return true;
    if (email && b.email && b.email === email) return true;
    if (userId && b.userId && b.userId === userId) return true;
    return false;
  });
}

export function createBlacklistEntry(input: {
  phone?: string;
  email?: string;
  userId?: string;
  reason?: string;
  sourceBookingId?: string;
}): StoreBlacklistEntry {
  return {
    id: `bl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    phone: input.phone?.replace(/\D/g, "").slice(0, 20) || undefined,
    email: input.email?.trim().toLowerCase().slice(0, 120) || undefined,
    userId: input.userId?.trim().slice(0, 80) || undefined,
    reason: input.reason?.trim().slice(0, 200) || undefined,
    createdAt: new Date().toISOString(),
    sourceBookingId: input.sourceBookingId,
  };
}

export function normalizeCustomers(
  list?: StoreCustomerCrm[] | null,
): StoreCustomerCrm[] {
  if (!Array.isArray(list)) return [];
  return list.map((c) => ({
    id: String(c.id || `cus-${Date.now()}`).slice(0, 40),
    phone: String(c.phone || "").replace(/\D/g, "").slice(0, 20),
    email: c.email?.trim().toLowerCase().slice(0, 120) || undefined,
    name: c.name?.trim().slice(0, 40) || undefined,
    storeCredit: Math.max(0, Number(c.storeCredit) || 0),
    packageNotes: String(c.packageNotes || "").slice(0, 500),
    hairNotes: String(c.hairNotes || "").slice(0, 2000),
    colorRecipe: String(c.colorRecipe || "").slice(0, 2000),
    preferenceNotes: String(c.preferenceNotes || "").slice(0, 2000),
    bookingCount: Math.max(0, Math.round(Number(c.bookingCount) || 0)),
    completedCount: Math.max(0, Math.round(Number(c.completedCount) || 0)),
    cancelledCount: Math.max(0, Math.round(Number(c.cancelledCount) || 0)),
    noShowCount: Math.max(0, Math.round(Number(c.noShowCount) || 0)),
    lastBookingAt: c.lastBookingAt || undefined,
    updatedAt: c.updatedAt || new Date().toISOString(),
    history: Array.isArray(c.history)
      ? c.history
          .map((h) => ({
            at: h.at || new Date().toISOString(),
            note: String(h.note || "").slice(0, 300),
            storeCredit:
              typeof h.storeCredit === "number" ? h.storeCredit : undefined,
            packageNotes:
              typeof h.packageNotes === "string"
                ? h.packageNotes.slice(0, 500)
                : undefined,
            hairNotes:
              typeof h.hairNotes === "string"
                ? h.hairNotes.slice(0, 2000)
                : undefined,
            colorRecipe:
              typeof h.colorRecipe === "string"
                ? h.colorRecipe.slice(0, 2000)
                : undefined,
          }))
          .slice(0, 50)
      : [],
  }));
}

/** 更新儲值／包套／髮況配方並寫入歷史 */
export function patchCustomerCrm(
  list: StoreCustomerCrm[],
  customerId: string,
  patch: {
    storeCredit?: number;
    packageNotes?: string;
    hairNotes?: string;
    colorRecipe?: string;
    preferenceNotes?: string;
    note?: string;
  },
) {
  const now = new Date().toISOString();
  return normalizeCustomers(list).map((c) => {
    if (c.id !== customerId) return c;
    const nextCredit =
      typeof patch.storeCredit === "number"
        ? Math.max(0, Math.round(patch.storeCredit))
        : c.storeCredit;
    const nextNotes =
      typeof patch.packageNotes === "string"
        ? patch.packageNotes.slice(0, 500)
        : c.packageNotes;
    const nextHair =
      typeof patch.hairNotes === "string"
        ? patch.hairNotes.slice(0, 2000)
        : c.hairNotes || "";
    const nextRecipe =
      typeof patch.colorRecipe === "string"
        ? patch.colorRecipe.slice(0, 2000)
        : c.colorRecipe || "";
    const nextPref =
      typeof patch.preferenceNotes === "string"
        ? patch.preferenceNotes.slice(0, 2000)
        : c.preferenceNotes || "";
    const changed =
      nextCredit !== c.storeCredit ||
      nextNotes !== c.packageNotes ||
      nextHair !== (c.hairNotes || "") ||
      nextRecipe !== (c.colorRecipe || "") ||
      nextPref !== (c.preferenceNotes || "");
    if (!changed) return c;
    const historyNote =
      patch.note?.trim() ||
      [
        nextCredit !== c.storeCredit
          ? `儲值 ${c.storeCredit} → ${nextCredit}`
          : "",
        nextNotes !== c.packageNotes ? `包套備註已更新` : "",
        nextHair !== (c.hairNotes || "") ? `髮況紀錄已更新` : "",
        nextRecipe !== (c.colorRecipe || "") ? `染劑配方已更新` : "",
        nextPref !== (c.preferenceNotes || "") ? `偏好備註已更新` : "",
      ]
        .filter(Boolean)
        .join("；");
    return {
      ...c,
      storeCredit: nextCredit,
      packageNotes: nextNotes,
      hairNotes: nextHair,
      colorRecipe: nextRecipe,
      preferenceNotes: nextPref,
      updatedAt: now,
      history: [
        {
          at: now,
          note: historyNote,
          storeCredit: nextCredit,
          packageNotes: nextNotes,
          hairNotes: nextHair,
          colorRecipe: nextRecipe,
        },
        ...(c.history || []),
      ].slice(0, 50),
    };
  });
}

export function upsertCustomerFromBooking(input: {
  list: StoreCustomerCrm[];
  phone: string;
  email?: string;
  name?: string;
  /** 是否計入預約次數（預設 true） */
  incrementBooking?: boolean;
  bookedAt?: string;
}) {
  const phone = input.phone.replace(/\D/g, "");
  const list = normalizeCustomers(input.list);
  const hit = list.find((c) => c.phone === phone);
  const now = input.bookedAt || new Date().toISOString();
  const bump = input.incrementBooking !== false;
  if (hit) {
    return list.map((c) =>
      c.phone === phone
        ? {
            ...c,
            name: input.name || c.name,
            email: input.email || c.email,
            bookingCount: bump
              ? (Number(c.bookingCount) || 0) + 1
              : Number(c.bookingCount) || 0,
            lastBookingAt: bump ? now : c.lastBookingAt || now,
            updatedAt: now,
          }
        : c,
    );
  }
  return [
    {
      id: `cus_${Date.now().toString(36)}`,
      phone,
      email: input.email,
      name: input.name,
      storeCredit: 0,
      packageNotes: "",
      hairNotes: "",
      colorRecipe: "",
      preferenceNotes: "",
      bookingCount: bump ? 1 : 0,
      completedCount: 0,
      cancelledCount: 0,
      noShowCount: 0,
      lastBookingAt: bump ? now : undefined,
      updatedAt: now,
      history: [],
    },
    ...list,
  ].slice(0, 2000);
}

/** 依預約狀態變動調整 CRM 完成／取消／放鳥計數 */
export function applyBookingStatusToCustomerCrm(input: {
  list: StoreCustomerCrm[];
  phone: string;
  prevStatus?: string | null;
  nextStatus: string;
}) {
  const phone = input.phone.replace(/\D/g, "");
  if (!phone) return normalizeCustomers(input.list);
  const prev = input.prevStatus || "confirmed";
  const next = input.nextStatus;
  if (prev === next) return normalizeCustomers(input.list);

  const dec = (c: StoreCustomerCrm, status: string): StoreCustomerCrm => {
    if (status === "completed") {
      return { ...c, completedCount: Math.max(0, (c.completedCount || 0) - 1) };
    }
    if (status === "cancelled") {
      return { ...c, cancelledCount: Math.max(0, (c.cancelledCount || 0) - 1) };
    }
    if (status === "no_show") {
      return { ...c, noShowCount: Math.max(0, (c.noShowCount || 0) - 1) };
    }
    return c;
  };
  const inc = (c: StoreCustomerCrm, status: string): StoreCustomerCrm => {
    if (status === "completed") {
      return { ...c, completedCount: (c.completedCount || 0) + 1 };
    }
    if (status === "cancelled") {
      return { ...c, cancelledCount: (c.cancelledCount || 0) + 1 };
    }
    if (status === "no_show") {
      return { ...c, noShowCount: (c.noShowCount || 0) + 1 };
    }
    return c;
  };

  return normalizeCustomers(input.list).map((c) => {
    if (c.phone !== phone) return c;
    let nextC = dec(c, prev);
    nextC = inc(nextC, next);
    return { ...nextC, updatedAt: new Date().toISOString() };
  });
}

/** 服務是否屬於燙髮／染髮（產品 tags 或名稱關鍵字） */
export function serviceHasPermOrColorTag(input: {
  serviceName: string;
  products?: Array<{ name?: string; tags?: string[] }> | null;
}) {
  const names = String(input.serviceName || "")
    .split(/[,、|/]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  const products = input.products || [];
  for (const name of names) {
    const hit = products.find((p) => p.name === name);
    const tags = (hit?.tags || []).map((t) => String(t).toLowerCase());
    if (
      tags.some((t) =>
        ["perm", "color", "燙", "染", "燙髮", "染髮", "漂"].some((k) =>
          t.includes(k),
        ),
      )
    ) {
      return true;
    }
    if (/燙|染|漂|perm|color|bleach/i.test(name)) return true;
  }
  return false;
}

/** 預約結束後 N 天的護理推播時間 */
export function computeCareRemindAt(
  startsAtIso: string,
  durationMinutes: number,
  daysAfter = 30,
) {
  const start = new Date(startsAtIso).getTime();
  if (!Number.isFinite(start)) return null;
  const end =
    start + Math.max(15, durationMinutes || 60) * 60 * 1000;
  const due = end + Math.max(1, daysAfter) * 24 * 60 * 60 * 1000;
  return new Date(due).toISOString();
}

export function normalizeBookingTerms(text?: string | null) {
  const t = (text || "").trim();
  return t || DEFAULT_BOOKING_TERMS;
}
