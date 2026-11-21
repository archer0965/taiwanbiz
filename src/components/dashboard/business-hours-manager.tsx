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
import {
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  defaultBusinessHours,
  formatHm,
  listCandidateSlotStarts,
  normalizeBusinessHours,
  parseHm,
  type BusinessHoursSettings,
  type WeekdayKey,
} from "@/lib/business-hours";
import {
  defaultOffPeakDiscount,
  normalizeOffPeakDiscount,
  type OffPeakDiscountSettings,
} from "@/lib/off-peak-discounts";
import { cn } from "@/lib/utils";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function ymdFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthMatrix(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const startPad = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{ ymd: string; inMonth: boolean; label: number } | null> =
    [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, monthIndex, day);
    cells.push({ ymd: ymdFromDate(d), inMonth: true, label: day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function BusinessHoursClient() {
  const { slug, content } = useActiveStore();
  const [hours, setHours] = useState<BusinessHoursSettings>(() =>
    defaultBusinessHours(),
  );
  const [offPeak, setOffPeak] = useState<OffPeakDiscountSettings>(() =>
    defaultOffPeakDiscount(),
  );
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(ymdFromDate(today));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const closeToast = useCallback(() => setToastOpen(false), []);

  useEffect(() => {
    if (content?.businessHours) {
      setHours(normalizeBusinessHours(content.businessHours));
    }
    if (content?.offPeakDiscount) {
      setOffPeak(normalizeOffPeakDiscount(content.offPeakDiscount));
    }
  }, [content]);

  const cells = useMemo(
    () => monthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const daySlots = useMemo(() => {
    const candidates = listCandidateSlotStarts(hours, selectedDate, 60);
    if (candidates.length > 0) return candidates;
    // 公休／整天鎖定時仍提供預設格子供手動鎖定時段
    const out: string[] = [];
    for (let t = parseHm("10:00"); t < parseHm("20:00"); t += 60) {
      out.push(formatHm(t));
    }
    return out;
  }, [hours, selectedDate]);

  function updateDay(
    key: WeekdayKey,
    patch: Partial<(typeof hours.week)[WeekdayKey]>,
  ) {
    setHours((h) => ({
      ...h,
      week: { ...h.week, [key]: { ...h.week[key], ...patch } },
    }));
  }

  function toggleBlockedDate(ymd: string) {
    setSelectedDate(ymd);
    setHours((h) => {
      const locked = h.blockedDates.includes(ymd);
      return {
        ...h,
        blockedDates: locked
          ? h.blockedDates.filter((d) => d !== ymd)
          : [...new Set([...h.blockedDates, ymd])],
      };
    });
  }

  function toggleBlockedSlot(ymd: string, time: string) {
    setHours((h) => {
      const exists = h.blockedSlots.some(
        (s) => s.date === ymd && s.time === time,
      );
      return {
        ...h,
        blockedSlots: exists
          ? h.blockedSlots.filter(
              (s) => !(s.date === ymd && s.time === time),
            )
          : [...h.blockedSlots, { date: ymd, time }],
      };
    });
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  async function handleSave() {
    if (!slug) {
      setError("找不到店家");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(slug)}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessHours: hours,
          offPeakDiscount: normalizeOffPeakDiscount(offPeak),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "儲存失敗");
      setToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "zh-TW",
    { year: "numeric", month: "long", timeZone: "Asia/Taipei" },
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          營業時間與時段設定
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          設定週營業區間、公休、特別休假鎖定與全局緩衝時間；前台預約會依服務時長
          + 緩衝自動防重疊。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基礎營業排程（週一至週日）</CardTitle>
          <CardDescription>
            各日可設營業區間（例如 10:00–20:00）；關閉 Toggle 即為固定公休日
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEEKDAY_KEYS.map((key) => {
            const day = hours.week[key];
            return (
              <div
                key={key}
                className="grid grid-cols-[4.5rem_auto_1fr_auto_1fr] items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 sm:gap-3"
              >
                <span className="text-sm font-semibold text-stone-800">
                  {WEEKDAY_LABELS[key]}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={day.open}
                  onClick={() => updateDay(key, { open: !day.open })}
                  className={cn(
                    "relative h-7 w-12 rounded-full transition",
                    day.open ? "bg-emerald-600" : "bg-stone-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
                      day.open ? "left-5" : "left-0.5",
                    )}
                  />
                  <span className="sr-only">
                    {day.open ? "營業中" : "公休"}
                  </span>
                </button>
                <Input
                  type="time"
                  value={day.start}
                  disabled={!day.open}
                  onChange={(e) => updateDay(key, { start: e.target.value })}
                  className="h-9 bg-white"
                  aria-label={`${WEEKDAY_LABELS[key]}開始`}
                />
                <span className="text-center text-xs text-stone-400">–</span>
                <Input
                  type="time"
                  value={day.end}
                  disabled={!day.open}
                  onChange={(e) => updateDay(key, { end: e.target.value })}
                  className="h-9 bg-white"
                  aria-label={`${WEEKDAY_LABELS[key]}結束`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>全局緩衝時間 buffer_time_minutes</CardTitle>
          <CardDescription>
            每次服務結束後預留整理／休息時間；前台佔用區間＝服務時長 + 緩衝
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="buffer">緩衝分鐘數</Label>
            <Input
              id="buffer"
              type="number"
              min={0}
              max={120}
              step={5}
              value={hours.bufferTimeMinutes}
              onChange={(e) =>
                setHours((h) => ({
                  ...h,
                  bufferTimeMinutes: Number(e.target.value) || 0,
                }))
              }
              className="mt-1.5 max-w-[12rem]"
            />
            <p className="mt-1.5 text-xs text-stone-500">
              目前 {hours.bufferTimeMinutes} 分鐘。服務時長請至{" "}
              <Link
                href="/dashboard/products"
                className="font-semibold text-stone-800 underline-offset-2 hover:underline"
              >
                服務項目
              </Link>{" "}
              設定各服務項目的時長（分鐘）。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>每日預約組數限制</CardTitle>
          <CardDescription>
            欄位 max_daily_bookings。預設不限制；啟用後，當日已成立預約數達上限，前台顯示「今日預約已額滿
            (Full)」並禁止選取任何時段。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">
                啟用每日預約上限
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                關閉＝不限制每日組數
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hours.maxDailyBookingsEnabled}
              onClick={() =>
                setHours((h) => ({
                  ...h,
                  maxDailyBookingsEnabled: !h.maxDailyBookingsEnabled,
                }))
              }
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition",
                hours.maxDailyBookingsEnabled ? "bg-emerald-600" : "bg-stone-300",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
                  hours.maxDailyBookingsEnabled ? "left-5" : "left-0.5",
                )}
              />
            </button>
          </div>
          <div
            className={cn(
              "flex flex-wrap items-end gap-2",
              !hours.maxDailyBookingsEnabled && "opacity-50",
            )}
          >
            <div>
              <Label htmlFor="max-daily">每日最多接待組數</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="max-daily"
                  type="number"
                  min={1}
                  max={50}
                  disabled={!hours.maxDailyBookingsEnabled}
                  value={hours.maxDailyBookings}
                  onChange={(e) =>
                    setHours((h) => ({
                      ...h,
                      maxDailyBookings: Math.max(
                        1,
                        Math.min(50, Number(e.target.value) || 4),
                      ),
                    }))
                  }
                  className="w-24"
                />
                <span className="text-sm font-medium text-stone-700">組</span>
              </div>
            </div>
            <p className="pb-2 text-xs text-stone-500">
              max_daily_bookings = {hours.maxDailyBookingsEnabled ? hours.maxDailyBookings : "∞"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>特別休假／手動鎖定（視覺化日曆）</CardTitle>
          <CardDescription>
            點日期切換整天鎖定；選取日期後再點時段即可 Block Out，前台顯示不可預約／已額滿
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => shiftMonth(-1)}
              aria-label="上一個月"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold text-stone-900">{monthLabel}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => shiftMonth(1)}
              aria-label="下一個月"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-stone-500">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell) {
                return <div key={`pad-${idx}`} className="aspect-square" />;
              }
              const dayBlocked = hours.blockedDates.includes(cell.ymd);
              const hasSlotLock = hours.blockedSlots.some(
                (s) => s.date === cell.ymd,
              );
              const selected = selectedDate === cell.ymd;
              const isToday = cell.ymd === ymdFromDate(today);
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => setSelectedDate(cell.ymd)}
                  onDoubleClick={() => toggleBlockedDate(cell.ymd)}
                  title="單擊選取；雙擊切換整天鎖定"
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-semibold transition",
                    dayBlocked
                      ? "border-rose-300 bg-rose-100 text-rose-900"
                      : selected
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-800 hover:border-stone-400",
                    isToday && !dayBlocked && !selected
                      ? "ring-2 ring-emerald-300"
                      : "",
                  )}
                >
                  {cell.label}
                  {hasSlotLock && !dayBlocked ? (
                    <span
                      className={cn(
                        "mt-0.5 h-1 w-1 rounded-full",
                        selected ? "bg-amber-300" : "bg-amber-500",
                      )}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-300" />
              整天鎖定
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-stone-900" />
              已選日期
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              有時段鎖定
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  {selectedDate} 時段鎖定
                </p>
                <p className="text-xs text-stone-500">
                  點擊時段切換 Block Out；雙擊上方日期可快速鎖／解整天
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleBlockedDate(selectedDate)}
                >
                  {hours.blockedDates.includes(selectedDate)
                    ? "解除整天鎖定"
                    : "鎖定整天"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHours((h) => ({
                      ...h,
                      blockedSlots: h.blockedSlots.filter(
                        (s) => s.date !== selectedDate,
                      ),
                    }))
                  }
                >
                  清除當日時段鎖
                </Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {daySlots.map((time) => {
                const locked = hours.blockedSlots.some(
                  (s) => s.date === selectedDate && s.time === time,
                );
                const dayLocked = hours.blockedDates.includes(selectedDate);
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={dayLocked}
                    onClick={() => toggleBlockedSlot(selectedDate, time)}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-sm font-semibold tabular-nums transition",
                      dayLocked
                        ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                        : locked
                          ? "border-rose-300 bg-rose-100 text-rose-900"
                          : "border-stone-200 bg-white text-stone-800 hover:border-stone-400",
                    )}
                  >
                    {time}
                    {locked ? " 鎖" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {(hours.blockedDates.length > 0 || hours.blockedSlots.length > 0) && (
            <div className="space-y-2 text-xs text-stone-600">
              {hours.blockedDates.length > 0 ? (
                <p>
                  已鎖整天：{hours.blockedDates.slice().sort().join("、")}
                </p>
              ) : null}
              {hours.blockedSlots.length > 0 ? (
                <p>
                  已鎖時段：
                  {hours.blockedSlots
                    .slice()
                    .sort((a, b) =>
                      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
                    )
                    .map((s) => `${s.date} ${s.time}`)
                    .join("、")}
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>離峰優惠設定（Off-Peak）</CardTitle>
          <CardDescription>
            勾選星期與時間區間；買家預約落在離峰時自動現折。通知會註記「套用離峰優惠」與現場應付金額。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">
                啟用離峰自動優惠
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                關閉後前台不顯示離峰標籤
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={offPeak.enabled}
              onClick={() =>
                setOffPeak((o) => ({ ...o, enabled: !o.enabled }))
              }
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition",
                offPeak.enabled ? "bg-emerald-600" : "bg-stone-300",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
                  offPeak.enabled ? "left-5" : "left-0.5",
                )}
              />
            </button>
          </div>

          <div className={cn(!offPeak.enabled && "pointer-events-none opacity-50")}>
            <Label>適用星期</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_KEYS.map((key) => {
                const on = offPeak.weekdays.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setOffPeak((o) => ({
                        ...o,
                        weekdays: on
                          ? o.weekdays.filter((d) => d !== key)
                          : [...o.weekdays, key],
                      }))
                    }
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                      on
                        ? "bg-stone-900 text-white"
                        : "border border-stone-200 bg-white text-stone-600",
                    )}
                  >
                    {WEEKDAY_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "grid gap-3 sm:grid-cols-2",
              !offPeak.enabled && "pointer-events-none opacity-50",
            )}
          >
            <div>
              <Label htmlFor="op-start">離峰開始</Label>
              <Input
                id="op-start"
                type="time"
                value={offPeak.start}
                onChange={(e) =>
                  setOffPeak((o) => ({ ...o, start: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="op-end">離峰結束</Label>
              <Input
                id="op-end"
                type="time"
                value={offPeak.end}
                onChange={(e) =>
                  setOffPeak((o) => ({ ...o, end: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>
          </div>

          <div
            className={cn(
              "space-y-3",
              !offPeak.enabled && "pointer-events-none opacity-50",
            )}
          >
            <Label>優惠方式</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOffPeak((o) => ({ ...o, mode: "fixed" }))}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold",
                  offPeak.mode === "fixed"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 text-stone-600",
                )}
              >
                固定折抵金額
              </button>
              <button
                type="button"
                onClick={() => setOffPeak((o) => ({ ...o, mode: "percent" }))}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold",
                  offPeak.mode === "percent"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 text-stone-600",
                )}
              >
                折扣比例
              </button>
            </div>
            {offPeak.mode === "fixed" ? (
              <div>
                <Label htmlFor="op-fixed">折抵金額（NT$）</Label>
                <Input
                  id="op-fixed"
                  type="number"
                  min={0}
                  max={50000}
                  step={10}
                  value={offPeak.fixedAmount}
                  onChange={(e) =>
                    setOffPeak((o) => ({
                      ...o,
                      fixedAmount: Math.max(0, Number(e.target.value) || 0),
                      promoCode:
                        !o.promoCode || /^OFFPEAK\d+$/.test(o.promoCode)
                          ? `OFFPEAK${Math.max(0, Number(e.target.value) || 0)}`
                          : o.promoCode,
                    }))
                  }
                  className="mt-1.5 max-w-[12rem]"
                />
                <p className="mt-1 text-xs text-stone-500">
                  例：-NT${offPeak.fixedAmount || 100}
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="op-pct">折扣百分比（% off）</Label>
                <Input
                  id="op-pct"
                  type="number"
                  min={1}
                  max={90}
                  value={offPeak.percentOff}
                  onChange={(e) =>
                    setOffPeak((o) => ({
                      ...o,
                      percentOff: Math.max(
                        1,
                        Math.min(90, Number(e.target.value) || 10),
                      ),
                      promoCode:
                        !o.promoCode || /^OFFPEAK\d+PCT$/.test(o.promoCode)
                          ? `OFFPEAK${Math.max(1, Math.min(90, Number(e.target.value) || 10))}PCT`
                          : o.promoCode,
                    }))
                  }
                  className="mt-1.5 max-w-[12rem]"
                />
                <p className="mt-1 text-xs text-stone-500">
                  {offPeak.percentOff}% off ≒{" "}
                  {((100 - offPeak.percentOff) / 10).toFixed(
                    (100 - offPeak.percentOff) % 10 === 0 ? 0 : 1,
                  )}
                  折（例：10＝九折）
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="op-code">優惠碼顯示名稱</Label>
              <Input
                id="op-code"
                value={offPeak.promoCode}
                onChange={(e) =>
                  setOffPeak((o) => ({
                    ...o,
                    promoCode: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_-]/g, "")
                      .slice(0, 24),
                  }))
                }
                placeholder="OFFPEAK100"
                className="mt-1.5 max-w-[16rem] font-mono"
              />
              <p className="mt-1 text-xs text-stone-500">
                LINE／訂單會顯示：套用優惠碼 ({offPeak.promoCode || "OFFPEAK100"}{" "}
                -$XXX)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        size="lg"
        className="h-12 bg-stone-900 hover:bg-stone-800"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? "儲存中…" : "儲存營業時間與離峰優惠"}
      </Button>
      <Toast
        open={toastOpen}
        onClose={closeToast}
        message="營業時間與離峰優惠已儲存並同步前台！"
      />
    </div>
  );
}

export function BusinessHoursManager() {
  const ready = useClientReady();
  if (!ready) {
    return (
      <div className="min-h-[240px] animate-pulse rounded-2xl bg-stone-100" />
    );
  }
  return <BusinessHoursClient />;
}
