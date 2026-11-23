import type { BookingRecord } from "@/lib/bookings";
import { toTaipeiDateAndTime } from "@/lib/bookings";
import { slotConflicts } from "@/lib/booking-conflicts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

/** Vercel 正式環境檔案系統多半唯讀，改寫入 /tmp；本機仍用專案 .data */
const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "taiwanbiz-bookings")
    : path.join(process.cwd(), ".data", "bookings");
const DATA_FILE = path.join(DATA_DIR, "all.json");

const g = globalThis as typeof globalThis & {
  __taiwanbizBookingsDiskCache?: BookingRecord[];
  __taiwanbizBookingsWriteChain?: Promise<unknown>;
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): BookingRecord[] {
  if (g.__taiwanbizBookingsDiskCache) return g.__taiwanbizBookingsDiskCache;
  try {
    ensureDir();
    if (!existsSync(DATA_FILE)) {
      g.__taiwanbizBookingsDiskCache = [];
      return g.__taiwanbizBookingsDiskCache;
    }
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as BookingRecord[];
    g.__taiwanbizBookingsDiskCache = Array.isArray(raw) ? raw : [];
  } catch {
    g.__taiwanbizBookingsDiskCache = [];
  }
  return g.__taiwanbizBookingsDiskCache;
}

function writeAll(list: BookingRecord[]) {
  ensureDir();
  const trimmed = list.slice(0, 2000);
  g.__taiwanbizBookingsDiskCache = trimmed;
  writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

/** Serialize disk mutations within this process (concurrent booking race). */
function withBookingWriteLock<T>(fn: () => T): Promise<T> {
  const prev = g.__taiwanbizBookingsWriteChain || Promise.resolve();
  let release!: (value: T | PromiseLike<T>) => void;
  let fail!: (reason?: unknown) => void;
  const next = new Promise<T>((resolve, reject) => {
    release = resolve;
    fail = reject;
  });
  g.__taiwanbizBookingsWriteChain = prev
    .catch(() => undefined)
    .then(async () => {
      try {
        release(fn());
      } catch (error) {
        fail(error);
      }
      await next.catch(() => undefined);
    });
  return next;
}

export function saveBookingDb(booking: BookingRecord) {
  const list = readAll();
  list.unshift(booking);
  writeAll(list);
  return booking;
}

/**
 * 原子寫入：同一 process 內序列化衝突檢查＋存檔。
 * cancelled 預約不佔用（slotConflicts 已略過）。
 * 回傳 conflict=true 時未寫入。
 */
export async function saveBookingIfSlotFreeDb(input: {
  booking: BookingRecord;
  dateYmd: string;
  timeHm: string;
  durationMinutes: number;
  bufferMinutes: number;
  staffName?: string;
  blockedSlots: Array<{ date: string; time: string }>;
}): Promise<{ ok: true; booking: BookingRecord } | { ok: false; conflict: true }> {
  return withBookingWriteLock(() => {
    // 重新讀盤，避免快取落後於同機其他寫入
    g.__taiwanbizBookingsDiskCache = undefined;
    const bookings = listBookingsForStoreDb(input.booking.storeSlug);
    if (
      slotConflicts({
        bookings,
        dateYmd: input.dateYmd,
        timeHm: input.timeHm,
        durationMinutes: input.durationMinutes,
        bufferMinutes: input.bufferMinutes,
        staffName: input.staffName,
        blockedSlots: input.blockedSlots,
      })
    ) {
      return { ok: false as const, conflict: true as const };
    }
    saveBookingDb(input.booking);
    return { ok: true as const, booking: input.booking };
  });
}

export function listBookingsDb() {
  return [...readAll()];
}

export function listBookingsForStoreDb(storeSlug: string) {
  return readAll().filter((b) => b.storeSlug === storeSlug);
}

/**
 * 行前提醒到期清單（略過已取消）。
 * 實際寄送：Vercel Cron → GET /api/cron/booking-reminders
 * → notifyBookingReminder（Email／LINE）→ markBookingReminderSentDb
 */
export function listBookingsDueForReminderDb(now = new Date()) {
  const ts = now.getTime();
  return readAll().filter((b) => {
    if ((b.status || "confirmed") === "cancelled") return false;
    if (b.reminderSentAt) return false;
    return new Date(b.remindAt).getTime() <= ts;
  });
}

/**
 * 課後關心應發送時間（台北）：
 * - 一般：服務當日 20:00（且不早於開始後 2 小時）
 * - 18:00 後開始的預約：改次日 10:00
 */
export function reviewPromptDueAtMs(startsAtIso: string) {
  const start = new Date(startsAtIso);
  const startMs = start.getTime();
  if (!Number.isFinite(startMs)) return NaN;
  const dateYmd = start.toLocaleDateString("en-CA", {
    timeZone: "Asia/Taipei",
  });
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      hour: "numeric",
      hour12: false,
    }).format(start),
  );
  if (hour >= 18) {
    const next = new Date(`${dateYmd}T12:00:00+08:00`);
    next.setDate(next.getDate() + 1);
    const nextYmd = next.toLocaleDateString("en-CA", {
      timeZone: "Asia/Taipei",
    });
    return new Date(`${nextYmd}T10:00:00+08:00`).getTime();
  }
  const evening = new Date(`${dateYmd}T20:00:00+08:00`).getTime();
  return Math.max(evening, startMs + 2 * 60 * 60 * 1000);
}

/** 服務當日晚上／次日：課後關心與五星好評導流 */
export function listBookingsDueForReviewPromptDb(now = new Date()) {
  const ts = now.getTime();
  return readAll().filter((b) => {
    if (b.reviewPromptSentAt) return false;
    const start = new Date(b.startsAt).getTime();
    if (!Number.isFinite(start) || start > ts) return false;
    const due = reviewPromptDueAtMs(b.startsAt);
    return Number.isFinite(due) && due <= ts;
  });
}

export function markBookingReminderSentDb(id: string, at = new Date()) {
  const list = readAll();
  const hit = list.find((b) => b.id === id);
  if (!hit) return null;
  hit.reminderSentAt = at.toISOString();
  writeAll(list);
  return hit;
}

/** 燙染護理回購推播到期清單 */
export function listBookingsDueForCareReminderDb(now = new Date()) {
  const ts = now.getTime();
  return readAll().filter((b) => {
    if (b.careReminderSentAt) return false;
    if (!b.careRemindAt) return false;
    const due = new Date(b.careRemindAt).getTime();
    return Number.isFinite(due) && due <= ts;
  });
}

export function updateBookingDb(
  id: string,
  patch: Partial<BookingRecord>,
) {
  const list = readAll();
  const hit = list.find((b) => b.id === id);
  if (!hit) return null;
  Object.assign(hit, patch);
  writeAll(list);
  return hit;
}

/** 取消後釋放時段：僅更新 status；衝突檢查會略過 cancelled */
export async function cancelBookingReleaseSlotDb(id: string) {
  return withBookingWriteLock(() => {
    const updated = updateBookingDb(id, { status: "cancelled" });
    return updated;
  });
}

/** Helper for callers that already have taipei parts */
export function bookingTaipeiParts(booking: BookingRecord) {
  return toTaipeiDateAndTime(booking.startsAt);
}
