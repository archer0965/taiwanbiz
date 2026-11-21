"use client";

import { LineCtaLink } from "@/components/line-cta-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_REFERENCE_IMAGE_TYPES,
  compressReferenceImage,
  isAllowedReferenceImageType,
} from "@/lib/compress-image";
import {
  computeDepositAmount,
  DEPOSIT_MODE_LABELS,
  normalizeDepositSettings,
  type DepositSettings,
} from "@/lib/deposit-settings";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Smartphone,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes?: number;
};

type SlotOption = {
  time: string;
  disabled: boolean;
  reason:
    | "past"
    | "booked"
    | "open"
    | "blocked"
    | "day_full"
    | "too_short"
    | "stylist_off";
  label?: string;
  startsAtLocal: string;
  dayFull?: boolean;
  durationMinutes?: number;
  offPeakApplied?: boolean;
  offPeakLabel?: string;
  listAmount?: number;
  discountAmount?: number;
  payAmount?: number;
};

type Props = {
  storeSlug: string;
  storeName: string;
  storeAddress?: string;
  lineUrl?: string;
  services?: ServiceOption[];
  staffOptions?: string[];
};

type SuccessPayload = {
  id: string;
  serviceName: string;
  staffName?: string;
  slotLabel: string;
  startsAtLocal: string;
  durationMinutes: number;
  listAmount?: number;
  offPeakDiscountAmount?: number;
  payAmount?: number;
  offPeakApplied?: boolean;
  promoCode?: string | null;
  depositAmount?: number;
  depositMethod?: string;
  depositStatus?: string;
  depositBankHint?: string;
};

function clampDuration(raw: unknown, fallback = 60) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(15, Math.min(480, n));
}

function todayYmdTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildGoogleCalendarUrl(input: {
  storeName: string;
  serviceName: string;
  staffName?: string;
  address?: string;
  startsAtLocal: string;
  durationMinutes?: number;
}) {
  const start = new Date(`${input.startsAtLocal}:00+08:00`);
  const mins = clampDuration(input.durationMinutes, 60);
  const end = new Date(start.getTime() + mins * 60 * 1000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${input.storeName}｜${input.serviceName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [
      `服務：${input.serviceName}`,
      input.staffName ? `設計師：${input.staffName}` : "",
      `門市：${input.storeName}`,
      input.address ? `地址：${input.address}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    location: input.address || input.storeName,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildIcsDataUrl(input: {
  storeName: string;
  serviceName: string;
  staffName?: string;
  address?: string;
  startsAtLocal: string;
  bookingId: string;
  durationMinutes?: number;
}) {
  const start = new Date(`${input.startsAtLocal}:00+08:00`);
  const mins = clampDuration(input.durationMinutes, 60);
  const end = new Date(start.getTime() + mins * 60 * 1000);
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaiwanBiz//Booking//ZH",
    "BEGIN:VEVENT",
    `UID:${input.bookingId}@taiwanbiz`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${input.storeName}｜${input.serviceName}`,
    `DESCRIPTION:服務：${input.serviceName}${input.staffName ? `\\n設計師：${input.staffName}` : ""}`,
    `LOCATION:${input.address || input.storeName}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function BookingForm({
  storeSlug,
  storeName,
  storeAddress = "",
  lineUrl,
  services = [],
  staffOptions = ["不指定", "設計師 A", "設計師 B"],
}: Props) {
  const catalog = useMemo(
    () =>
      services.length
        ? services
        : [{ id: "consult", name: "諮詢／體驗", durationMinutes: 60 }],
    [services],
  );
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>(() =>
    catalog[0]?.name ? [catalog[0].name] : [],
  );
  const [staffName, setStaffName] = useState("不指定");
  const [dateYmd, setDateYmd] = useState(() => todayYmdTaipei());
  const minBookableDate = useMemo(() => todayYmdTaipei(), []);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [dayFull, setDayFull] = useState(false);
  const [dayBookingMeta, setDayBookingMeta] = useState<{
    count: number;
    max: number | null;
  }>({ count: 0, max: null });
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [note, setNote] = useState("");
  const [termsText, setTermsText] = useState(
    "遲到超過 15 分鐘得視為自動取消；請於預約日前一天告知改期。不開放攜帶寵物。",
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [imageStatus, setImageStatus] = useState("");
  const [liveStaffOptions, setLiveStaffOptions] = useState<string[] | null>(
    null,
  );
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessPayload | null>(null);
  const [depositSettings, setDepositSettings] = useState<DepositSettings>(
    () => normalizeDepositSettings(null),
  );
  const [depositBankLastFive, setDepositBankLastFive] = useState("");

  const resolvedStaffOptions = liveStaffOptions || staffOptions;

  const totalDurationMinutes = useMemo(() => {
    if (!selectedServices.length) return 60;
    return selectedServices.reduce((sum, name) => {
      const hit = catalog.find((s) => s.name === name);
      return sum + clampDuration(hit?.durationMinutes, 60);
    }, 0);
  }, [catalog, selectedServices]);

  const serviceLabel = selectedServices.join("、");

  function toggleService(name: string) {
    setSelectedServices((prev) => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev;
        return prev.filter((n) => n !== name);
      }
      return [...prev, name];
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function loadOps() {
      try {
        const res = await fetch(
          `/api/stores/${encodeURIComponent(storeSlug)}/content`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          content?: {
            bookingTerms?: string;
            depositSettings?: DepositSettings;
            staff?: Array<{ name?: string; active?: boolean }>;
          };
        };
        if (cancelled) return;
        if (data.content?.bookingTerms?.trim()) {
          setTermsText(data.content.bookingTerms.trim());
        }
        // 前台正規化後 ecpay 會降級為 none；僅展示免訂金／匯款
        const normalized = normalizeDepositSettings(
          data.content?.depositSettings,
        );
        setDepositSettings({
          ...normalized,
          mode:
            normalized.mode === "bank_transfer" ? "bank_transfer" : "none",
        });
        const staffList = data.content?.staff || [];
        const active = staffList.filter(
          (s) => s.active !== false && s.name?.trim(),
        );
        const names = active.map((s) => String(s.name).trim());
        const owner =
          active.find((s) => (s as { isOwner?: boolean }).isOwner)?.name ||
          names[0] ||
          "店長／本人";
        if (names.length) {
          setLiveStaffOptions(["不指定", ...names]);
          setStaffName((prev) =>
            ["不指定", ...names].includes(prev) && prev !== "不指定"
              ? prev
              : String(owner),
          );
        }
      } catch {
        /* keep defaults */
      }
    }
    void loadOps();
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  async function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const room = Math.max(0, 3 - referenceImages.length);
    if (room <= 0) {
      setError("參考圖最多 3 張");
      return;
    }

    const picked = Array.from(files).slice(0, room);
    const rejected = picked.filter((f) => !isAllowedReferenceImageType(f.type));
    const accepted = picked.filter((f) => isAllowedReferenceImageType(f.type));

    if (rejected.length && !accepted.length) {
      setError("僅支援 JPEG、PNG、WebP 圖片，請重新選擇");
      setImageStatus("");
      return;
    }
    if (rejected.length) {
      setError("部分檔案格式不支援（僅 JPEG／PNG／WebP），已略過");
    } else {
      setError("");
    }
    if (!accepted.length) return;

    setImageCompressing(true);
    setImageStatus("圖片壓縮上傳中，請稍候...");
    const next = [...referenceImages];
    try {
      for (const file of accepted) {
        if (next.length >= 3) break;
        try {
          const dataUrl = await compressReferenceImage(file);
          next.push(dataUrl);
        } catch (err) {
          console.error("[reference-image]", err);
          setError(
            err instanceof Error
              ? err.message || "圖片壓縮失敗，請改選較小的照片"
              : "圖片壓縮失敗，請改選較小的照片",
          );
          setImageStatus("圖片壓縮上傳中，請稍候...");
        }
      }
      setReferenceImages(next.slice(0, 3));
      if (next.length > referenceImages.length) {
        setImageStatus(
          `已壓縮並加入 ${next.length - referenceImages.length} 張參考圖（單張約 200–400KB）`,
        );
      }
    } finally {
      setImageCompressing(false);
      window.setTimeout(() => {
        setImageStatus((cur) =>
          cur === "圖片壓縮上傳中，請稍候..." ? "" : cur,
        );
      }, 1600);
    }
  }

  const loadSlots = useCallback(async () => {
    if (!dateYmd || !storeSlug || !selectedServices.length) return;
    setSlotsLoading(true);
    try {
      const params = new URLSearchParams({
        storeSlug,
        date: dateYmd,
        staffName: staffName === "不指定" ? "" : staffName,
        durationMinutes: String(totalDurationMinutes),
      });
      for (const name of selectedServices) {
        params.append("serviceName", name);
      }
      const res = await fetch(`/api/booking?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        slots?: SlotOption[];
        dayFull?: boolean;
        dayBookingCount?: number;
        maxDailyBookings?: number | null;
        max_daily_bookings?: number | null;
        durationMinutes?: number;
      };
      const next = data.slots || [];
      const full =
        Boolean(data.dayFull) ||
        next.some((s) => s.dayFull || s.reason === "day_full");
      setSlots(next);
      setDayFull(full);
      setDayBookingMeta({
        count: Number(data.dayBookingCount) || 0,
        max:
          data.max_daily_bookings ??
          data.maxDailyBookings ??
          null,
      });
      setSelectedSlot((prev) => {
        if (full) return "";
        const stillOpen = next.find(
          (s) => s.startsAtLocal === prev && !s.disabled,
        );
        if (stillOpen) return prev;
        return next.find((s) => !s.disabled)?.startsAtLocal || "";
      });
    } catch {
      setSlots([]);
      setDayFull(false);
      setDayBookingMeta({ count: 0, max: null });
      setSelectedSlot("");
    } finally {
      setSlotsLoading(false);
    }
  }, [
    dateYmd,
    staffName,
    storeSlug,
    selectedServices,
    totalDurationMinutes,
  ]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (imageCompressing) {
      setError("圖片壓縮上傳中，請稍候...");
      return;
    }
    if (!customerName.trim()) {
      setError("請填寫姓名");
      return;
    }
    const normalized = normalizeTaiwanMobile(phone);
    if (!isValidTaiwanMobile(normalized)) {
      setError("請輸入正確的台灣手機號碼（09 開頭共 10 碼）");
      return;
    }
    if (!selectedServices.length) {
      setError("請至少選擇一項服務");
      return;
    }
    if (!selectedSlot) {
      setError("請選擇可預約時段（灰底為已額滿、時長不足或已過期）");
      return;
    }
    if (!termsAccepted) {
      setError("請勾選「我已閱讀並同意店家預約與取消須知」");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          storeName,
          customerName: customerName.trim(),
          customerPhone: normalized,
          customerEmail: email.trim() || undefined,
          serviceName: serviceLabel,
          serviceNames: selectedServices,
          durationMinutes: totalDurationMinutes,
          staffName: staffName === "不指定" ? undefined : staffName,
          startsAt: selectedSlot,
          note: note.trim() || undefined,
          referenceImages,
          termsAccepted: true,
          website: honeypot,
          depositBankLastFive:
            depositSettings.mode === "bank_transfer"
              ? depositBankLastFive
              : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        booking?: {
          id?: string;
          slotLabel?: string;
          serviceName?: string;
          staffName?: string;
          durationMinutes?: number;
          listAmount?: number;
          offPeakDiscountAmount?: number;
          payAmount?: number;
          offPeakApplied?: boolean;
          promoCode?: string | null;
          depositAmount?: number;
          depositMethod?: string;
          depositStatus?: string;
        };
        deposit?: {
          mode?: string;
          amount?: number;
          bankHint?: string;
          checkoutPath?: string | null;
        } | null;
      };
      if (!res.ok) {
        setError(data.error || "預約失敗，請稍後再試");
        void loadSlots();
        return;
      }

      // 不觸發 ECPay SDK／線上刷卡；直接完成輕量預約
      setSuccess({
        id: data.booking?.id || "",
        serviceName: data.booking?.serviceName || serviceLabel,
        staffName: data.booking?.staffName,
        slotLabel: data.booking?.slotLabel || selectedSlot,
        startsAtLocal: selectedSlot,
        durationMinutes:
          data.booking?.durationMinutes || totalDurationMinutes,
        listAmount: data.booking?.listAmount,
        offPeakDiscountAmount: data.booking?.offPeakDiscountAmount,
        payAmount: data.booking?.payAmount,
        offPeakApplied: data.booking?.offPeakApplied,
        promoCode: data.booking?.promoCode,
        depositAmount: data.booking?.depositAmount,
        depositMethod: data.booking?.depositMethod,
        depositStatus: data.booking?.depositStatus,
        depositBankHint: data.deposit?.bankHint,
      });
      setCustomerName("");
      setPhone("");
      setEmail("");
      setNote("");
      setReferenceImages([]);
      setTermsAccepted(false);
      setDepositBankLastFive("");
      void loadSlots();
    } catch {
      setError("網路異常，請稍後再試或改用電話／LINE 聯絡");
    } finally {
      setLoading(false);
    }
  }

  const selectedPayAmount = useMemo(() => {
    const hit = slots.find((s) => s.startsAtLocal === selectedSlot);
    return typeof hit?.payAmount === "number" ? hit.payAmount : 0;
  }, [slots, selectedSlot]);

  const previewDeposit = useMemo(
    () => computeDepositAmount(depositSettings, selectedPayAmount),
    [depositSettings, selectedPayAmount],
  );

  const gcalUrl = success
    ? buildGoogleCalendarUrl({
        storeName,
        serviceName: success.serviceName,
        staffName: success.staffName,
        address: storeAddress,
        startsAtLocal: success.startsAtLocal,
        durationMinutes: success.durationMinutes,
      })
    : "";
  const icsUrl = success
    ? buildIcsDataUrl({
        storeName,
        serviceName: success.serviceName,
        staffName: success.staffName,
        address: storeAddress,
        startsAtLocal: success.startsAtLocal,
        bookingId: success.id,
        durationMinutes: success.durationMinutes,
      })
    : "";

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="relative space-y-4 rounded-3xl border border-stone-200/80 bg-gradient-to-b from-stone-50 to-white p-5 shadow-sm sm:p-8"
      >
        <div>
          <h2 className="text-xl font-bold text-stone-900 sm:text-2xl">
            線上極速預約
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            可複選服務項目；系統依總時長鎖定連續空檔，避免美髮撞期。灰底＝已額滿／時長不足／已過期。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bk-name">姓名</Label>
            <Input
              id="bk-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="如何稱呼您"
              disabled={loading}
              className="border-stone-200 bg-white text-base sm:text-sm"
            />
          </div>
          <div>
            <Label htmlFor="bk-phone">手機號碼</Label>
            <Input
              id="bk-phone"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              disabled={loading}
              maxLength={20}
              className="border-stone-200 bg-white text-base sm:text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bk-email">Email（選填，用於成功通知與行前提醒）</Label>
            <Input
              id="bk-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              className="border-stone-200 bg-white text-base sm:text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>服務項目（可複選）</Label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {catalog.map((svc) => {
                const checked = selectedServices.includes(svc.name);
                const mins = clampDuration(svc.durationMinutes, 60);
                return (
                  <label
                    key={svc.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
                      checked
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-800 hover:border-stone-300",
                      loading && "pointer-events-none opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      disabled={loading}
                      onChange={() => toggleService(svc.name)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{svc.name}</span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs",
                          checked ? "text-stone-300" : "text-stone-500",
                        )}
                      >
                        約 {mins} 分鐘
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-stone-500">
              已選 {selectedServices.length} 項・合計需連續{" "}
              <span className="font-semibold text-stone-800">
                {totalDurationMinutes} 分鐘
              </span>
              {selectedServices.length > 1 ? `（${serviceLabel}）` : ""}
            </p>
          </div>
          <div>
            <Label htmlFor="bk-staff">指定設計師／服務人員</Label>
            <select
              id="bk-staff"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              disabled={loading}
              className="mt-1.5 flex h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-base text-stone-900 sm:h-10 sm:text-sm"
            >
              {resolvedStaffOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bk-date">預約日期</Label>
            <Input
              id="bk-date"
              type="date"
              min={minBookableDate}
              value={dateYmd}
              onChange={(e) => setDateYmd(e.target.value)}
              disabled={loading}
              className="border-stone-200 bg-white text-base sm:text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>可預約時段</Label>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slotsLoading && (
                <p className="col-span-full text-xs text-stone-400">載入時段…</p>
              )}
              {!slotsLoading &&
                slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={slot.disabled || loading}
                    onClick={() => setSelectedSlot(slot.startsAtLocal)}
                    className={cn(
                      "rounded-xl border px-2 py-2.5 text-sm font-medium transition",
                      slot.disabled
                        ? "cursor-not-allowed border-stone-200 bg-stone-200/80 text-stone-400 line-through"
                        : selectedSlot === slot.startsAtLocal
                          ? "border-stone-800 bg-stone-900 text-stone-50 shadow-sm"
                          : slot.offPeakApplied
                            ? "border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-400"
                            : "border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50",
                    )}
                    title={
                      slot.label ||
                      (slot.reason === "booked"
                        ? "已額滿／撞期"
                        : slot.reason === "blocked"
                          ? "不可預約"
                          : slot.reason === "stylist_off"
                            ? "設計師非值班"
                            : slot.reason === "too_short"
                              ? `需連續 ${totalDurationMinutes} 分`
                              : slot.reason === "day_full"
                                ? "今日已額滿"
                                : slot.reason === "past"
                                  ? "已過期"
                                  : "可預約")
                    }
                  >
                    {slot.time}
                    {slot.disabled &&
                    (slot.reason === "booked" ||
                      slot.reason === "blocked" ||
                      slot.reason === "stylist_off" ||
                      slot.reason === "too_short" ||
                      slot.reason === "day_full") ? (
                      <span className="mt-0.5 block text-[10px] font-normal no-underline">
                        {slot.reason === "blocked"
                          ? "不可預約"
                          : slot.reason === "stylist_off"
                            ? "非值班"
                            : slot.reason === "too_short"
                              ? "時長不足"
                              : "已額滿"}
                      </span>
                    ) : null}
                    {!slot.disabled && slot.offPeakApplied ? (
                      <span
                        className={cn(
                          "mt-0.5 block text-[10px] font-semibold no-underline",
                          selectedSlot === slot.startsAtLocal
                            ? "text-amber-200"
                            : "text-amber-700",
                        )}
                      >
                        離峰折 $
                        {Number(slot.discountAmount || 0).toLocaleString(
                          "en-US",
                        )}
                      </span>
                    ) : null}
                  </button>
                ))}
            </div>
            {(() => {
              const selected = slots.find(
                (s) => s.startsAtLocal === selectedSlot && !s.disabled,
              );
              if (selected?.offPeakApplied && (selected.discountAmount || 0) > 0) {
                return (
                  <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                    {selected.offPeakLabel ||
                      `🔥 離峰優惠現折 $${Number(selected.discountAmount).toLocaleString("en-US")}`}
                    <span className="mt-0.5 block text-xs font-normal text-amber-900/80">
                      原價 NT${" "}
                      {Number(selected.listAmount || 0).toLocaleString("en-US")}
                      ｜現場應付 NT${" "}
                      {Number(selected.payAmount || 0).toLocaleString("en-US")}
                    </span>
                  </p>
                );
              }
              return null;
            })()}
            {dayFull ? (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
                今日預約已額滿 (Full)
                {dayBookingMeta.max
                  ? `｜已滿 ${dayBookingMeta.count}/${dayBookingMeta.max} 組`
                  : ""}
                ，請改選其他日期
              </p>
            ) : (
              <p className="mt-2 text-xs text-stone-400">
                依合計 {totalDurationMinutes}{" "}
                分鐘＋緩衝鎖定連續空檔；琥珀色＝離峰優惠；灰底＝不可預約／已額滿／時長不足／已過期
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bk-note">風格備註（選填）</Label>
            <Textarea
              id="bk-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="想做的款式、過敏、偏好、改期需求…"
              disabled={loading}
              className="border-stone-200 bg-white text-base sm:text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bk-refs">上傳參考圖片（選填，最多 3 張）</Label>
            <Input
              id="bk-refs"
              type="file"
              accept={ALLOWED_REFERENCE_IMAGE_TYPES.join(",")}
              multiple
              disabled={
                loading || imageCompressing || referenceImages.length >= 3
              }
              onChange={(e) => {
                void onPickImages(e.target.files);
                e.target.value = "";
              }}
              className="mt-1.5 border-stone-200 bg-white text-base sm:text-sm"
            />
            {imageCompressing || imageStatus ? (
              <p
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800"
                role="status"
                aria-live="polite"
              >
                {imageCompressing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {imageStatus || "圖片壓縮上傳中，請稍候..."}
              </p>
            ) : null}
            {referenceImages.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {referenceImages.map((src, idx) => (
                  <button
                    key={`${idx}-${src.slice(0, 24)}`}
                    type="button"
                    className="relative h-16 w-16 overflow-hidden rounded-xl border border-stone-200"
                    disabled={imageCompressing}
                    onClick={() =>
                      setReferenceImages((list) =>
                        list.filter((_, i) => i !== idx),
                      )
                    }
                    title="點擊移除"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`參考圖 ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-stone-400">
                可上傳美甲／美睫樣式參考圖。選擇後會自動壓縮至約
                200–400KB（JPEG／PNG／WebP）。
              </p>
            )}
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-stone-200 bg-white/80 p-3">
            <p className="text-xs font-semibold tracking-wide text-stone-500">
              店家預約須知
            </p>
            <pre className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-stone-600">
              {termsText}
            </pre>
            <label className="mt-3 flex items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-stone-300"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={loading}
              />
              <span>
                {termsAccepted ? "[x]" : "[ ]"}{" "}
                我已閱讀並同意店家預約與取消須知
              </span>
            </label>
          </div>
        </div>

        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <Label htmlFor="bk-website">網站</Label>
          <Input
            id="bk-website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {depositSettings.mode !== "none" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">
              {DEPOSIT_MODE_LABELS[depositSettings.mode]}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
              {previewDeposit > 0
                ? `預估訂金 NT$ ${previewDeposit.toLocaleString("en-US")}（依所選時段／服務金額計算）`
                : "選擇時段後顯示訂金金額"}
              。剩餘尾款現場結清。
            </p>
            {depositSettings.mode === "bank_transfer" ? (
              <div className="mt-3">
                <p className="text-xs text-amber-900/80">
                  {depositSettings.bankHint}
                </p>
                <Label htmlFor="bk-deposit-five" className="mt-2 block">
                  匯款帳號後五碼（可預約後再補）
                </Label>
                <Input
                  id="bk-deposit-five"
                  className="mt-1 max-w-[10rem] border-amber-200 bg-white"
                  inputMode="numeric"
                  maxLength={5}
                  value={depositBankLastFive}
                  onChange={(e) =>
                    setDepositBankLastFive(
                      e.target.value.replace(/\D/g, "").slice(0, 5),
                    )
                  }
                  placeholder="12345"
                  disabled={loading}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full bg-stone-900 text-stone-50 hover:bg-stone-800 sm:w-auto"
          disabled={loading || imageCompressing}
        >
          {imageCompressing
            ? "圖片壓縮上傳中，請稍候..."
            : loading
              ? "送出中…"
              : "確認預約"}
        </Button>
      </form>

      {success ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-success-title"
        >
          <div className="relative w-full max-w-md animate-[fadeIn_0.35s_ease] overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-b from-stone-50 via-white to-stone-50 p-5 shadow-2xl sm:p-6">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-stone-200/50 blur-2xl" />
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              onClick={() => setSuccess(null)}
              aria-label="關閉"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-stone-50 shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <h3
                  id="booking-success-title"
                  className="text-lg font-bold text-stone-900"
                >
                  預約成功
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  店家已收到即時通知；行前會再提醒您到店。
                </p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 rounded-2xl border border-stone-200 bg-white/80 p-4 text-sm text-stone-700">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-400">服務項目</dt>
                <dd className="font-medium text-right">{success.serviceName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-400">時間</dt>
                <dd className="font-medium text-right">{success.slotLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-400">服務時長</dt>
                <dd className="font-medium text-right">
                  {success.durationMinutes} 分鐘
                </dd>
              </div>
              {typeof success.listAmount === "number" &&
              success.listAmount > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-400">原價</dt>
                  <dd className="font-medium text-right">
                    NT$ {success.listAmount.toLocaleString("en-US")}
                  </dd>
                </div>
              ) : null}
              {success.offPeakApplied &&
              (success.offPeakDiscountAmount || 0) > 0 ? (
                <div className="flex justify-between gap-3 text-amber-800">
                  <dt>套用優惠碼</dt>
                  <dd className="font-semibold text-right">
                    {success.promoCode || "OFFPEAK"} -$
                    {Number(success.offPeakDiscountAmount).toLocaleString(
                      "en-US",
                    )}
                  </dd>
                </div>
              ) : null}
              {typeof success.payAmount === "number" ? (
                <div className="flex justify-between gap-3 border-t border-stone-100 pt-2">
                  <dt className="font-semibold text-stone-700">
                    最終現場應付金額
                  </dt>
                  <dd className="font-bold text-right text-stone-900">
                    NT$ {success.payAmount.toLocaleString("en-US")}
                  </dd>
                </div>
              ) : null}
              {typeof success.depositAmount === "number" &&
              success.depositAmount > 0 ? (
                <div className="flex justify-between gap-3 text-amber-900">
                  <dt className="font-semibold">訂金</dt>
                  <dd className="font-bold text-right">
                    NT$ {success.depositAmount.toLocaleString("en-US")}
                    {success.depositStatus
                      ? `（${success.depositStatus}）`
                      : ""}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-stone-400">設計師</dt>
                <dd className="font-medium text-right">
                  {success.staffName || "不指定"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-400">門市</dt>
                <dd className="font-medium text-right">{storeName}</dd>
              </div>
              {storeAddress ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-400">地址</dt>
                  <dd className="font-medium text-right">{storeAddress}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-900 text-sky-50">
                  <Smartphone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">
                    將此預約頁面加入手機主畫面，下次預約更快速！
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-sky-900/80">
                    iOS: 分享 ➜ 加入主畫面　／　Android: 選單 ➜ 新增至主畫面
                  </p>
                </div>
              </div>
            </div>
            {success.depositMethod === "bank_transfer" &&
            (success.depositAmount || 0) > 0 ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                {success.depositBankHint ||
                  "請完成匯款訂金；後五碼已送出者請等候店家對帳。"}
              </p>
            ) : null}
            <div className="mt-4 grid gap-2">
              <a href={gcalUrl} target="_blank" rel="noopener noreferrer">
                <Button as="span" className="h-11 w-full bg-stone-900 hover:bg-stone-800">
                  <CalendarPlus className="h-4 w-4" />
                  一鍵加入 Google 日曆
                </Button>
              </a>
              <a href={icsUrl} download={`${success.id || "booking"}.ics`}>
                <Button
                  as="span"
                  variant="outline"
                  className="h-11 w-full border-stone-300"
                >
                  <CalendarPlus className="h-4 w-4" />
                  下載 iOS／Outlook 日曆檔
                </Button>
              </a>
              <LineCtaLink href={lineUrl}>
                <Button
                  as="span"
                  variant="outline"
                  className="h-11 w-full border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  一鍵開啟 LINE 官方帳號
                </Button>
              </LineCtaLink>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
