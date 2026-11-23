/**
 * Smoke: same-designer conflict + cancelled release + concurrent save.
 * Pure logic mirror of slotConflicts + process-local write lock behavior.
 */
import { createRequire } from "module";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", ".data", "bookings-smoke");
const dataFile = path.join(dataDir, "all.json");

function rangesOverlap(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}
function hmToMin(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function occupied(timeHm, duration, buffer) {
  const start = hmToMin(timeHm);
  return { start, end: start + duration + buffer };
}
function conflicts({ bookings, dateYmd, timeHm, durationMinutes, bufferMinutes, staffName }) {
  const proposed = occupied(timeHm, durationMinutes, bufferMinutes);
  const staffFilter = staffName && staffName !== "不指定" ? staffName : null;
  return bookings.some((b) => {
    if ((b.status || "confirmed") === "cancelled") return false;
    if (!b.startsAt.includes(dateYmd)) return false;
    if (staffFilter && b.staffName && b.staffName !== staffFilter) return false;
    const time = b.startsAt.slice(11, 16);
    const existing = occupied(time, b.durationMinutes || 60, bufferMinutes);
    return rangesOverlap(proposed.start, proposed.end, existing.start, existing.end);
  });
}

let chain = Promise.resolve();
function withLock(fn) {
  const next = chain.then(() => fn());
  chain = next.catch(() => undefined);
  return next;
}

function readAll() {
  if (!existsSync(dataFile)) return [];
  return JSON.parse(readFileSync(dataFile, "utf8"));
}
function writeAll(list) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(dataFile, JSON.stringify(list, null, 2));
}

async function saveIfFree(booking, opts) {
  return withLock(() => {
    const bookings = readAll().filter((b) => b.storeSlug === booking.storeSlug);
    if (conflicts({ bookings, ...opts })) return { ok: false, conflict: true };
    const list = readAll();
    list.unshift(booking);
    writeAll(list);
    return { ok: true, booking };
  });
}

async function cancel(id) {
  return withLock(() => {
    const list = readAll();
    const hit = list.find((b) => b.id === id);
    if (!hit) return null;
    hit.status = "cancelled";
    writeAll(list);
    return hit;
  });
}

rmSync(dataDir, { recursive: true, force: true });

const base = {
  storeSlug: "smoke",
  staffName: "設計師甲",
  durationMinutes: 60,
  status: "confirmed",
  startsAt: "2026-12-01T10:00:00+08:00",
};

const same = conflicts({
  bookings: [base],
  dateYmd: "2026-12-01",
  timeHm: "10:30",
  durationMinutes: 60,
  bufferMinutes: 0,
  staffName: "設計師甲",
});
const other = conflicts({
  bookings: [base],
  dateYmd: "2026-12-01",
  timeHm: "10:30",
  durationMinutes: 60,
  bufferMinutes: 0,
  staffName: "設計師乙",
});
const released = conflicts({
  bookings: [{ ...base, status: "cancelled" }],
  dateYmd: "2026-12-01",
  timeHm: "10:00",
  durationMinutes: 60,
  bufferMinutes: 0,
  staffName: "設計師甲",
});

const a = {
  id: "c1",
  storeSlug: "smoke",
  staffName: "設計師甲",
  durationMinutes: 90,
  status: "confirmed",
  startsAt: "2026-12-02T11:00:00+08:00",
};
const b = { ...a, id: "c2" };
const [r1, r2] = await Promise.all([
  saveIfFree(a, {
    dateYmd: "2026-12-02",
    timeHm: "11:00",
    durationMinutes: 90,
    bufferMinutes: 0,
    staffName: "設計師甲",
  }),
  saveIfFree(b, {
    dateYmd: "2026-12-02",
    timeHm: "11:00",
    durationMinutes: 90,
    bufferMinutes: 0,
    staffName: "設計師甲",
  }),
]);
const winId = r1.ok ? r1.booking.id : r2.ok ? r2.booking.id : null;
await cancel(winId);
const after = await saveIfFree(
  { ...b, id: "c3" },
  {
    dateYmd: "2026-12-02",
    timeHm: "11:00",
    durationMinutes: 90,
    bufferMinutes: 0,
    staffName: "設計師甲",
  },
);

const report = {
  sameStaffConflict: same,
  otherStaffOk: !other,
  cancelledReleases: !released,
  concurrentOneWin: [r1, r2].filter((x) => x.ok).length === 1,
  afterCancelOk: after.ok,
};
console.log(JSON.stringify(report, null, 2));
if (!Object.values(report).every(Boolean)) process.exit(1);
rmSync(dataDir, { recursive: true, force: true });
