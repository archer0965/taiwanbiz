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
  Check,
  Lock,
  Plus,
  Search,
  Unlock,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type BookingRow = BookingRecord & { blacklisted?: boolean };
type BlockedSlot = { date: string; time: string };
type ViewMode = "day" | "week" | "month" | "list" | "staff";

function bookingPayAmount(b: BookingRow) {
  if (typeof b.payAmount === "number" && Number.isFinite(b.payAmount)) {
    return Math.max(0, b.payAmount);
  }
  if (typeof b.listAmount === "number" && Number.isFinite(b.listAmount)) {
    return Math.max(0, b.listAmount);
  }
  return 0;
}

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending_deposit: "border-amber-300 bg-amber-50 text-amber-950",
  confirmed: "border-sky-300 bg-sky-50 text-sky-950",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-950",
  cancelled: "border-stone-300 bg-stone-100 text-stone-500 line-through",
  no_show: "border-rose-300 bg-rose-50 text-rose-950",
};

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

function monthFromDate(dateYmd: string) {
  const [y, m] = dateYmd.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const days = Array.from({ length: lastDay }, (_, i) =>
    addDaysYmd(first, i),
  );
  // Pad leading blanks so Monday-first calendar aligns
  const firstDow = new Date(`${first}T12:00:00+08:00`).getUTCDay();
  const mondayPad = firstDow === 0 ? 6 : firstDow - 1;
  return { from: first, to, days, mondayPad, year: y, month: m };
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
  const [staffFilter, setStaffFilter] = useState("");
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
  const month = useMemo(() => monthFromDate(date), [date]);
  const slots = useMemo(() => timeSlots(), []);
  const [monthStatsBookings, setMonthStatsBookings] = useState<BookingRow[]>(
    [],
  );

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
          : view === "month" || view === "list"
            ? `from=${encodeURIComponent(month.from)}&to=${encodeURIComponent(month.to)}`
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
      const names = (data.staff || [])
        .map((s) => s.name || "")
        .filter(Boolean);
      setStaffNames(names);
      setProductNames(
        (data.products || []).map((p) => p.name || "").filter(Boolean),
      );
      if (view === "month" || view === "list") {
        setMonthStatsBookings(data.bookings || []);
      }
      setStaffFilter((prev) => {
        if (view === "staff" && !prev && names[0]) return names[0];
        if (prev && names.length && !names.includes(prev)) {
          return names[0] || "";
        }
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [slug, date, view, week.from, week.to, month.from, month.to]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep month stats fresh even when viewing day/week
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = `from=${encodeURIComponent(month.from)}&to=${encodeURIComponent(month.to)}`;
        const res = await fetch(
          `/api/stores/${encodeURIComponent(slug)}/bookings?${qs}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as { bookings?: BookingRow[] };
        if (!cancelled && res.ok) setMonthStatsBookings(data.bookings || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, month.from, month.to]);

  const visibleBookings = useMemo(() => {
    if (view !== "staff" || !staffFilter) return bookings;
    return bookings.filter((b) => (b.staffName || "") === staffFilter);
  }, [bookings, view, staffFilter]);

  const opsStats = useMemo(() => {
    const today = todayYmdTaipei();
    let todayCount = 0;
    let todayRevenue = 0;
    let selectedDayCount = 0;
    let selectedDayRevenue = 0;
    const serviceCount = new Map<string, number>();
    for (const b of monthStatsBookings) {
      if ((b.status || "confirmed") === "cancelled") continue;
      const parts = toTaipeiDateAndTime(b.startsAt);
      const amount = bookingPayAmount(b);
      if (parts?.date === today) {
        todayCount += 1;
        todayRevenue += amount;
      }
      if (parts?.date === date) {
        selectedDayCount += 1;
        selectedDayRevenue += amount;
      }
      const names = String(b.serviceName || "")
        .split(/[、,/|]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const n of names.length ? names : ["未命名服務"]) {
        serviceCount.set(n, (serviceCount.get(n) || 0) + 1);
      }
    }
    // day/staff view：當日列表可能比月統計更即時
    if (view === "day" || view === "staff") {
      selectedDayCount = 0;
      selectedDayRevenue = 0;
      for (const b of visibleBookings) {
        if ((b.status || "confirmed") === "cancelled") continue;
        const parts = toTaipeiDateAndTime(b.startsAt);
        if (parts?.date !== date) continue;
        selectedDayCount += 1;
        selectedDayRevenue += bookingPayAmount(b);
      }
    }
    const popular = [...serviceCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const activeMonth = monthStatsBookings.filter(
      (b) => (b.status || "confirmed") !== "cancelled",
    ).length;
    return {
      todayCount,
      todayRevenue,
      selectedDayCount,
      selectedDayRevenue,
      activeMonth,
      popular,
    };
  }, [monthStatsBookings, date, view, visibleBookings]);

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
    if (view === "staff" && staffFilter) {
      setManualStaff(staffFilter);
    }
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

  function bookingsFor(dateYmd: string, timeHm: string, includeCancelled = false) {
    return visibleBookings.filter((b) => {
      if (!includeCancelled && (b.status || "confirmed") === "cancelled") {
        return false;
      }
      const parts = toTaipeiDateAndTime(b.startsAt);
      if (!parts || parts.date !== dateYmd) return false;
      const start = parseHm(parts.time);
      const end = start + Math.max(30, b.durationMinutes || 60);
      const slot = parseHm(timeHm);
      return slot >= start && slot < end;
    });
  }

  function bookingsOnDay(dateYmd: string) {
    return visibleBookings.filter((b) => {
      const parts = toTaipeiDateAndTime(b.startsAt);
      return parts?.date === dateYmd;
    });
  }

  function statusClass(b: BookingRow) {
    const status = (b.status || "confirmed") as BookingStatus;
    if (STATUS_COLOR[status]) return STATUS_COLOR[status];
    if (b.source === "walk_in" || b.source === "manual") {
      return "border-violet-300 bg-violet-50 text-violet-950";
    }
    return STATUS_COLOR.confirmed;
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
            日／週／月／設計師行事曆與列表；可快速新增現場客、一鍵改狀態或封鎖時段。
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-stone-500">
              選定日預約數（{date.slice(5)}）
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">
              {opsStats.selectedDayCount}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              今日全店 {opsStats.todayCount} 筆
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-stone-500">
              選定日營收（{date.slice(5)}）
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">
              NT${opsStats.selectedDayRevenue.toLocaleString("en-US")}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              今日 NT${opsStats.todayRevenue.toLocaleString("en-US")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-stone-500">本月預約總數</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">
              {opsStats.activeMonth}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-stone-500">熱門服務項目</p>
            <ul className="mt-2 space-y-1">
              {opsStats.popular.length === 0 ? (
                <li className="text-sm text-stone-400">尚無資料</li>
              ) : (
                opsStats.popular.map(([name, count]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 text-sm text-stone-700"
                  >
                    <span className="truncate">{name}</span>
                    <span className="tabular-nums text-stone-500">{count}</span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" />
            檢視與日期
          </CardTitle>
          <CardDescription>
            台北時區 · 設計師行事曆可篩單人班表 · 色彩：待訂金／已確認／已完成／已取消
          </CardDescription>
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
          <div className="flex flex-wrap rounded-xl border border-stone-200 p-1">
            {(
              [
                ["day", "日"],
                ["week", "週"],
                ["month", "月"],
                ["staff", "設計師行事曆"],
                ["list", "列表"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setView(id);
                  if (id === "staff" && !staffFilter && staffNames[0]) {
                    setStaffFilter(staffNames[0]);
                  }
                }}
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
          {view === "staff" ? (
            <div>
              <Label htmlFor="bk-staff-filter">設計師</Label>
              <select
                id="bk-staff-filter"
                className="mt-1.5 w-44 rounded-lg border border-stone-200 px-2 py-2 text-sm"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
              >
                {staffNames.length === 0 ? (
                  <option value="">尚無設計師</option>
                ) : (
                  staffNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : null}
          {view === "week" ? (
            <p className="text-xs text-stone-500">
              {week.from} ～ {week.to}
            </p>
          ) : null}
          {view === "month" || view === "list" ? (
            <p className="text-xs text-stone-500">
              {month.from} ～ {month.to}
            </p>
          ) : null}
          {view === "staff" && staffFilter ? (
            <p className="text-xs text-stone-500">
              僅顯示「{staffFilter}」當日班表與預約
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-[11px] text-stone-500">
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5">
              待訂金
            </span>
            <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5">
              已確認
            </span>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5">
              已完成
            </span>
            <span className="rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5">
              已取消
            </span>
          </div>
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
          bookings={visibleBookings}
          busyId={busyId}
          onBlacklist={(b) => void addToBlacklist(b)}
          onStatus={(id, s) => void updateStatus(id, s)}
          onConfirmDeposit={(id) => void confirmDeposit(id)}
        />
      ) : view === "month" ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-stone-500">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: month.mondayPad }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[88px] rounded-lg bg-stone-50/50" />
            ))}
            {month.days.map((d) => {
              const dayBookings = bookingsOnDay(d);
              const isToday = d === todayYmdTaipei();
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDate(d);
                    setView("day");
                  }}
                  className={cn(
                    "min-h-[88px] rounded-lg border p-1.5 text-left transition hover:border-teal-400 hover:bg-teal-50/40",
                    isToday
                      ? "border-teal-500 bg-teal-50/50"
                      : "border-stone-100 bg-white",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      isToday ? "text-teal-800" : "text-stone-700",
                    )}
                  >
                    {Number(d.slice(8))}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {dayBookings.slice(0, 3).map((b) => (
                      <p
                        key={b.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                          statusClass(b),
                        )}
                      >
                        {b.customerName}
                      </p>
                    ))}
                    {dayBookings.length > 3 ? (
                      <p className="text-[10px] text-stone-400">
                        +{dayBookings.length - 3}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
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
                              statusClass(b),
                            )}
                            style={{ height: `${rows * 44 - 4}px` }}
                            title={`${b.customerName} · ${b.serviceName} · ${STATUS_LABEL[(b.status || "confirmed") as BookingStatus]}`}
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

      {view !== "list" && visibleBookings.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-700">當期預約明細</h2>
          <BookingList
            bookings={visibleBookings}
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
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => {
      const name = (b.customerName || "").toLowerCase();
      const phone = (b.customerPhone || "").replace(/\s+/g, "");
      return name.includes(q) || phone.includes(q.replace(/\s+/g, ""));
    });
  }, [bookings, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋顧客姓名或電話"
          className="pl-9"
          aria-label="搜尋預約"
        />
      </div>
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-stone-500">
            {bookings.length === 0 ? "此期間尚無預約。" : "找不到符合的預約。"}
          </CardContent>
        </Card>
      ) : (
        filtered.map((b) => {
          const status = (b.status || "confirmed") as BookingStatus;
          return (
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
                      {` · ${STATUS_LABEL[status] || status}`}
                      {typeof b.depositAmount === "number" &&
                      b.depositAmount > 0
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
                    {status !== "confirmed" && status !== "completed" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-sky-700 text-white hover:bg-sky-800"
                        disabled={busyId === b.id}
                        onClick={() => onStatus(b.id, "confirmed")}
                      >
                        <Check className="h-3.5 w-3.5" />
                        確認
                      </Button>
                    ) : null}
                    {status !== "completed" && status !== "cancelled" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-700 text-white hover:bg-emerald-800"
                        disabled={busyId === b.id}
                        onClick={() => onStatus(b.id, "completed")}
                      >
                        完成
                      </Button>
                    ) : null}
                    {status !== "cancelled" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-stone-300 text-stone-700"
                        disabled={busyId === b.id}
                        onClick={() => onStatus(b.id, "cancelled")}
                      >
                        <X className="h-3.5 w-3.5" />
                        取消
                      </Button>
                    ) : null}
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
          );
        })
      )}
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
