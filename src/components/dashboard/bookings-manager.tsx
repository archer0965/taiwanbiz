"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import type { BookingRecord, BookingStatus } from "@/lib/bookings";
import { toTaipeiDateAndTime } from "@/lib/bookings";
import { formatHm, parseHm } from "@/lib/business-hours";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { cn } from "@/lib/utils";
import {
  Ban,
  CalendarRange,
  Lock,
  Plus,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type BookingRow = BookingRecord & { blacklisted?: boolean };
type BlockedSlot = { date: string; time: string };
type ViewMode = "day" | "week" | "list";

const DAY_START = 9 * 60;
const DAY_END = 21 * 60;
const STEP = 30;

function todayYmdTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysYmd(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00+08:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function weekFromDate(dateYmd: string) {
  const d = new Date(`${dateYmd}T12:00:00+08:00`);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const from = addDaysYmd(dateYmd, mondayOffset);
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(from, i));
  return { from, to: days[6], days };
}

function timeSlots() {
  const out: string[] = [];
  for (let t = DAY_START; t < DAY_END; t += STEP) out.push(formatHm(t));
  return out;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
  no_show: "未到",
  pending_deposit: "待訂金",
};

function BookingsClient() {
  const { slug } = useActiveStore();
  const [date, setDate] = useState(todayYmdTaipei);
  const [view, setView] = useState<ViewMode>("day");
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const closeToast = useCallback(() => setToastOpen(false), []);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(todayYmdTaipei);
  const [manualTime, setManualTime] = useState("10:00");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualService, setManualService] = useState("現場服務");
  const [manualStaff, setManualStaff] = useState("");
  const [manualDuration, setManualDuration] = useState(60);
  const [manualWalkIn, setManualWalkIn] = useState(true);
  const [manualNote, setManualNote] = useState("");

  const week = useMemo(() => weekFromDate(date), [date]);
  const slots = useMemo(() => timeSlots(), []);

  const load = useCallback(async () => {
    if (!slug) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs =
        view === "week"
          ? `from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}`
          : `date=${encodeURIComponent(date)}`;
      const res = await fetch(
        `/api/stores/${encodeURIComponent(slug)}/bookings?${qs}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        error?: string;
        bookings?: BookingRow[];
        blockedSlots?: BlockedSlot[];
        staff?: Array<{ name?: string }>;
        products?: Array<{ name?: string }>;
      };
      if (!res.ok) throw new Error(data.error || "載入失敗");
      setBookings(data.bookings || []);
      setBlockedSlots(data.blockedSlots || []);
      setStaffNames(
        (data.staff || []).map((s) => s.name || "").filter(Boolean),
      );
      setProductNames(
        (data.products || []).map((p) => p.name || "").filter(Boolean),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [slug, date, view, week.from, week.to]);

  useEffect(() => {
    void load();
  }, [load]);

  function toast(msg: string) {
    setToastMsg(msg);
    setToastOpen(true);
  }

  async function postAction(body: Record<string, unknown>) {
    if (!slug) return null;
    const res = await fetch(
      `/api/stores/${encodeURIComponent(slug)}/bookings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) throw new Error(data.error || "操作失敗");
    return data;
  }

  async function addToBlacklist(booking: BookingRow) {
    const reason = window.prompt("黑名單原因（選填）", "多次放鳥／惡意取消");
    if (reason === null) return;
    setBusyId(booking.id);
    try {
      const data = await postAction({
        action: "blacklist",
        phone: booking.customerPhone,
        email: booking.customerEmail,
        userId: booking.customerLineUserId,
        reason: reason.trim() || undefined,
        bookingId: booking.id,
      });
      toast(data?.message || "已加入黑名單");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "加入失敗");
    } finally {
      setBusyId(null);
    }
  }

  async function updateStatus(bookingId: string, status: BookingStatus) {
    setBusyId(bookingId);
    try {
      const data = await postAction({
        action: "update_status",
        bookingId,
        status,
      });
      toast(data?.message || "已更新");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeposit(bookingId: string) {
    setBusyId(bookingId);
    try {
      const data = await postAction({
        action: "confirm_deposit",
        bookingId,
      });
      toast(data?.message || "已確認訂金");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "確認失敗");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBlock(dateYmd: string, time: string, block: boolean) {
    try {
      const data = await postAction({
        action: block ? "block_slot" : "unblock_slot",
        date: dateYmd,
        time,
      });
      toast(data?.message || (block ? "已封鎖" : "已解除"));
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "操作失敗");
    }
  }

  function openManual(dateYmd: string, time: string, walkIn = true) {
    setManualDate(dateYmd);
    setManualTime(time);
    setManualWalkIn(walkIn);
    setManualOpen(true);
  }

  async function submitManual() {
    try {
      const data = await postAction({
        action: "manual_booking",
        customerName: manualName,
        customerPhone: manualPhone,
        serviceName: manualService,
        staffName: manualStaff || undefined,
        date: manualDate,
        time: manualTime,
        durationMinutes: manualDuration,
        note: manualNote || undefined,
        source: manualWalkIn ? "walk_in" : "manual",
      });
      toast(data?.message || "已新增");
      setManualOpen(false);
      setManualName("");
      setManualPhone("");
      setManualNote("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "新增失敗");
    }
  }

  const dayColumns = view === "week" ? week.days : [date];

  function bookingsFor(dateYmd: string, timeHm: string) {
    return bookings.filter((b) => {
      if ((b.status || "confirmed") === "cancelled") return false;
      const parts = toTaipeiDateAndTime(b.startsAt);
      if (!parts || parts.date !== dateYmd) return false;
      const start = parseHm(parts.time);
      const end = start + Math.max(30, b.durationMinutes || 60);
      const slot = parseHm(timeHm);
      return slot >= start && slot < end;
    });
  }

  function isBlocked(dateYmd: string, timeHm: string) {
    return blockedSlots.some((s) => s.date === dateYmd && s.time === timeHm);
  }

  function isBookingStart(b: BookingRow, dateYmd: string, timeHm: string) {
    const parts = toTaipeiDateAndTime(b.startsAt);
    return Boolean(parts && parts.date === dateYmd && parts.time === timeHm);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            預約時間軸日曆
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            每日／每週時間軸檢視空檔與預約；可快速新增現場客或一鍵封鎖時段。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-teal-700 text-white hover:bg-teal-800"
            onClick={() => openManual(date, "10:00", true)}
          >
            <Plus className="h-4 w-4" />
            快速新增現場客
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" />
            檢視與日期
          </CardTitle>
          <CardDescription>台北時區 · 30 分鐘格線</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="bk-cal-date">日期</Label>
            <Input
              id="bk-cal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-44"
            />
          </div>
          <div className="flex rounded-xl border border-stone-200 p-1">
            {(
              [
                ["day", "每日"],
                ["week", "每週"],
                ["list", "列表"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  view === id
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "week" ? (
            <p className="text-xs text-stone-500">
              {week.from} ～ {week.to}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-stone-500">載入預約中…</p>
      ) : view === "list" ? (
        <BookingList
          bookings={bookings}
          busyId={busyId}
          onBlacklist={(b) => void addToBlacklist(b)}
          onStatus={(id, s) => void updateStatus(id, s)}
          onConfirmDeposit={(id) => void confirmDeposit(id)}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div
            className="min-w-[720px]"
            style={{
              display: "grid",
              gridTemplateColumns: `72px repeat(${dayColumns.length}, minmax(120px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-10 border-b border-r border-stone-200 bg-stone-50 p-2 text-xs font-semibold text-stone-500">
              時間
            </div>
            {dayColumns.map((d) => (
              <div
                key={d}
                className="border-b border-r border-stone-200 bg-stone-50 p-2 text-center text-xs font-semibold text-stone-700"
              >
                {d.slice(5)}
                <span className="mt-0.5 block font-normal text-stone-400">
                  {new Date(`${d}T12:00:00+08:00`).toLocaleDateString("zh-TW", {
                    weekday: "short",
                    timeZone: "Asia/Taipei",
                  })}
                </span>
              </div>
            ))}

            {slots.map((time) => (
              <div key={`row-${time}`} className="contents">
                <div className="sticky left-0 z-10 border-b border-r border-stone-100 bg-white px-2 py-1 text-[11px] tabular-nums text-stone-500">
                  {time}
                </div>
                {dayColumns.map((d) => {
                  const hits = bookingsFor(d, time);
                  const blocked = isBlocked(d, time);
                  const starters = hits.filter((b) => isBookingStart(b, d, time));
                  return (
                    <div
                      key={`${d}-${time}`}
                      className={cn(
                        "relative min-h-[44px] border-b border-r border-stone-100 p-0.5",
                        blocked && "bg-stone-200/80",
                        !blocked && hits.length === 0 && "hover:bg-teal-50/60",
                      )}
                    >
                      {starters.map((b) => {
                        const rows = Math.max(
                          1,
                          Math.ceil((b.durationMinutes || 60) / STEP),
                        );
                        return (
                          <div
                            key={b.id}
                            className={cn(
                              "absolute inset-x-0.5 z-[1] overflow-hidden rounded-md border px-1.5 py-1 text-[10px] leading-tight shadow-sm",
                              b.status === "pending_deposit"
                                ? "border-amber-300 bg-amber-50 text-amber-950"
                                : b.status === "completed"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                  : b.source === "walk_in" || b.source === "manual"
                                    ? "border-violet-300 bg-violet-50 text-violet-950"
                                    : "border-sky-300 bg-sky-50 text-sky-950",
                            )}
                            style={{ height: `${rows * 44 - 4}px` }}
                            title={`${b.customerName} · ${b.serviceName}`}
                          >
                            <p className="truncate font-semibold">
                              {b.customerName}
                            </p>
                            <p className="truncate opacity-80">{b.serviceName}</p>
                          </div>
                        );
                      })}
                      {!blocked && hits.length === 0 ? (
                        <div className="flex h-full items-center justify-center gap-1 opacity-0 transition hover:opacity-100">
                          <button
                            type="button"
                            className="rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-medium text-white"
                            onClick={() => openManual(d, time, true)}
                            title="新增現場客"
                          >
                            +客
                          </button>
                          <button
                            type="button"
                            className="rounded bg-stone-700 px-1.5 py-0.5 text-[10px] font-medium text-white"
                            onClick={() => void toggleBlock(d, time, true)}
                            title="封鎖時段"
                          >
                            <Lock className="inline h-3 w-3" />
                          </button>
                        </div>
                      ) : null}
                      {blocked ? (
                        <button
                          type="button"
                          className="absolute inset-0 z-[2] flex items-center justify-center text-[10px] font-medium text-stone-600 hover:bg-stone-300/40"
                          onClick={() => void toggleBlock(d, time, false)}
                          title="解除封鎖"
                        >
                          <Unlock className="mr-0.5 h-3 w-3" />
                          封鎖
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {view !== "list" && bookings.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-700">當期預約明細</h2>
          <BookingList
            bookings={bookings}
            busyId={busyId}
            onBlacklist={(b) => void addToBlacklist(b)}
            onStatus={(id, s) => void updateStatus(id, s)}
            onConfirmDeposit={(id) => void confirmDeposit(id)}
            compact
          />
        </div>
      ) : null}

      {manualOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">
              {manualWalkIn ? "快速新增現場客" : "手動新增預約"}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {manualDate} {manualTime} · 不經前台、直接佔用時段
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <Label>姓名</Label>
                <Input
                  className="mt-1"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="現場客姓名"
                />
              </div>
              <div>
                <Label>手機</Label>
                <Input
                  className="mt-1"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="0912345678"
                />
              </div>
              <div>
                <Label>服務</Label>
                <Input
                  className="mt-1"
                  list="manual-services"
                  value={manualService}
                  onChange={(e) => setManualService(e.target.value)}
                />
                <datalist id="manual-services">
                  {productNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>設計師</Label>
                  <select
                    className="mt-1 w-full rounded-lg border border-stone-200 px-2 py-2 text-sm"
                    value={manualStaff}
                    onChange={(e) => setManualStaff(e.target.value)}
                  >
                    <option value="">不指定</option>
                    {staffNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>時長（分）</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    value={manualDuration}
                    onChange={(e) =>
                      setManualDuration(Number(e.target.value) || 60)
                    }
                  />
                </div>
              </div>
              <div>
                <Label>備註</Label>
                <Input
                  className="mt-1"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={manualWalkIn}
                  onChange={(e) => setManualWalkIn(e.target.checked)}
                />
                標記為現場客（Walk-in）
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                className="flex-1 bg-teal-700 hover:bg-teal-800"
                onClick={() => void submitManual()}
              >
                確認新增
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setManualOpen(false)}
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Toast open={toastOpen} onClose={closeToast} message={toastMsg} />
    </div>
  );
}

function BookingList({
  bookings,
  busyId,
  onBlacklist,
  onStatus,
  onConfirmDeposit,
  compact,
}: {
  bookings: BookingRow[];
  busyId: string | null;
  onBlacklist: (b: BookingRow) => void;
  onStatus: (id: string, s: BookingStatus) => void;
  onConfirmDeposit: (id: string) => void;
  compact?: boolean;
}) {
  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-stone-500">
          此期間尚無預約。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <Card key={b.id}>
          <CardHeader className={cn("pb-2", compact && "py-3")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg">
                  {b.slotLabel} · {b.serviceName}
                </CardTitle>
                <CardDescription>
                  {b.customerName} · {b.customerPhone}
                  {b.staffName ? ` · ${b.staffName}` : ""}
                  {b.source === "walk_in"
                    ? " · 現場客"
                    : b.source === "manual"
                      ? " · 手動"
                      : ""}
                  {b.blacklisted ? " · 已在黑名單" : ""}
                  {b.status
                    ? ` · ${STATUS_LABEL[b.status] || b.status}`
                    : ""}
                  {typeof b.depositAmount === "number" && b.depositAmount > 0
                    ? ` · 訂金 NT$${b.depositAmount}（${b.depositStatus || "pending"}）`
                    : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {b.depositStatus === "reported" ||
                b.depositStatus === "pending" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-300 text-amber-900"
                    disabled={busyId === b.id}
                    onClick={() => onConfirmDeposit(b.id)}
                  >
                    確認訂金
                  </Button>
                ) : null}
                <select
                  className="rounded-lg border border-stone-200 px-2 py-2 text-xs"
                  value={b.status || "confirmed"}
                  disabled={busyId === b.id}
                  onChange={(e) =>
                    onStatus(b.id, e.target.value as BookingStatus)
                  }
                >
                  {(
                    Object.keys(STATUS_LABEL) as BookingStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-300 text-rose-800"
                  disabled={busyId === b.id || b.blacklisted}
                  onClick={() => onBlacklist(b)}
                >
                  <Ban className="h-4 w-4" />
                  {b.blacklisted ? "已在黑名單" : "黑名單"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {!compact && b.note ? (
            <CardContent className="pt-0 text-sm text-stone-600">
              <p className="whitespace-pre-wrap rounded-xl bg-stone-50 px-3 py-2">
                {b.note}
              </p>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export function BookingsManager() {
  const ready = useClientReady();
  if (!ready) {
    return (
      <div className="min-h-[240px] animate-pulse rounded-2xl bg-stone-100" />
    );
  }
  return <BookingsClient />;
}
