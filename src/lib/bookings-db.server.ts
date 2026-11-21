import type { BookingRecord } from "@/lib/bookings";
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

export function saveBookingDb(booking: BookingRecord) {
  const list = readAll();
  list.unshift(booking);
  writeAll(list);
  return booking;
}

export function listBookingsDb() {
  return [...readAll()];
}

export function listBookingsForStoreDb(storeSlug: string) {
  return readAll().filter((b) => b.storeSlug === storeSlug);
}

export function listBookingsDueForReminderDb(now = new Date()) {
  const ts = now.getTime();
  return readAll().filter(
    (b) => !b.reminderSentAt && new Date(b.remindAt).getTime() <= ts,
  );
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
