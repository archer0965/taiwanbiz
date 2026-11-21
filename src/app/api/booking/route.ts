import {
  computeCareRemindAt,
  isBlacklisted,
  normalizeBookingTerms,
  normalizeCareRetargeting,
  normalizeStaffMembers,
  serviceHasPermOrColorTag,
  staffNameOptions,
  stylistAcceptsSlot,
  upsertCustomerFromBooking,
} from "@/lib/beauty-ops";
import {
  computeRemindAt,
  createBookingId,
  formatSlotLabel,
  toTaipeiDateAndTime,
  type BookingRecord,
} from "@/lib/bookings";
import {
  listBookingsForStoreDb,
  saveBookingDb,
  updateBookingDb,
} from "@/lib/bookings-db.server";
import {
  notifyBookingCreated,
  resolveSellerLineTargets,
} from "@/lib/booking-notify";
import {
  bookingOccupiedRangeMinutes,
  clampDurationMinutes,
  listCandidateSlotStarts,
  normalizeBusinessHours,
  rangesOverlap,
  serviceFitsWithinOpeningHours,
  sumServicesDurationMinutes,
} from "@/lib/business-hours";
import {
  computeDepositAmount,
  isEcpayDepositLive,
  normalizeDepositSettings,
} from "@/lib/deposit-settings";
import {
  deriveOffPeakPromoCode,
  normalizeOffPeakDiscount,
  quoteOffPeakDiscount,
  sumServicesListAmount,
} from "@/lib/off-peak-discounts";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import {
  getStoreContent,
  patchStoreContent,
} from "@/lib/store-content-db.server";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { isTenantBookingSuspended } from "@/lib/tenants";
import { NextResponse } from "next/server";

function parseServiceNames(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .map((n) => String(n || "").trim())
          .filter(Boolean),
      ),
    ];
  }
  const text = String(raw || "").trim();
  if (!text) return [];
  return [
    ...new Set(
      text
        .split(/[,、|/]+/)
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];
}

function resolveDurationMinutes(
  content: Awaited<ReturnType<typeof getStoreContent>>,
  serviceNames: string[],
  durationOverride?: number,
) {
  if (
    typeof durationOverride === "number" &&
    Number.isFinite(durationOverride) &&
    durationOverride > 0
  ) {
    return clampDurationMinutes(durationOverride);
  }
  return sumServicesDurationMinutes(
    content?.profile?.products,
    serviceNames,
  );
}

function readBookingDurationMinutes(booking: BookingRecord) {
  if (
    typeof booking.durationMinutes === "number" &&
    Number.isFinite(booking.durationMinutes)
  ) {
    return clampDurationMinutes(booking.durationMinutes);
  }
  const fromNote = Number(booking.note?.match(/duration:(\d+)/)?.[1]);
  return clampDurationMinutes(fromNote || 60);
}

function slotConflicts(input: {
  storeSlug: string;
  dateYmd: string;
  timeHm: string;
  durationMinutes: number;
  bufferMinutes: number;
  staffName?: string;
  blockedSlots: Array<{ date: string; time: string }>;
}) {
  const proposed = bookingOccupiedRangeMinutes(
    input.timeHm,
    input.durationMinutes,
    input.bufferMinutes,
  );

  // 手動鎖定時段：起點落在佔用區間內，或與鎖定時段本身（視為同等服務時長）重疊
  for (const s of input.blockedSlots) {
    if (s.date !== input.dateYmd) continue;
    if (s.time === input.timeHm) return true;
    const blocked = bookingOccupiedRangeMinutes(
      s.time,
      input.durationMinutes,
      input.bufferMinutes,
    );
    if (
      rangesOverlap(proposed.start, proposed.end, blocked.start, blocked.end)
    ) {
      return true;
    }
  }

  return listBookingsForStoreDb(input.storeSlug).some((b) => {
    const parts = toTaipeiDateAndTime(b.startsAt);
    if (!parts || parts.date !== input.dateYmd) return false;
    if (input.staffName && input.staffName !== "不指定") {
      if (b.staffName && b.staffName !== input.staffName) return false;
    }
    const existingDuration = readBookingDurationMinutes(b);
    const existing = bookingOccupiedRangeMinutes(
      parts.time,
      existingDuration,
      input.bufferMinutes,
    );
    return rangesOverlap(
      proposed.start,
      proposed.end,
      existing.start,
      existing.end,
    );
  });
}

async function buildSlots(input: {
  storeSlug: string;
  dateYmd: string;
  staffName?: string;
  serviceNames: string[];
  durationOverride?: number;
}) {
  const content = await getStoreContent(input.storeSlug);
  const hours = normalizeBusinessHours(content?.businessHours);
  const offPeak = normalizeOffPeakDiscount(content?.offPeakDiscount);
  const duration = resolveDurationMinutes(
    content,
    input.serviceNames,
    input.durationOverride,
  );
  const listAmount = sumServicesListAmount(
    content?.profile?.products,
    input.serviceNames,
  );
  const candidates = listCandidateSlotStarts(hours, input.dateYmd, 30);
  const dayCount = listBookingsForStoreDb(input.storeSlug).filter((b) => {
    const parts = toTaipeiDateAndTime(b.startsAt);
    return parts?.date === input.dateYmd;
  }).length;
  const dayFull =
    hours.maxDailyBookingsEnabled && dayCount >= hours.maxDailyBookings;
  const now = new Date();
  const dayBlocked = hours.blockedDates.includes(input.dateYmd);
  const slots = candidates.map((time) => {
    const starts = new Date(`${input.dateYmd}T${time}:00+08:00`);
    const past =
      Number.isNaN(starts.getTime()) || starts.getTime() <= now.getTime();
    const slotLocked = hours.blockedSlots.some(
      (s) => s.date === input.dateYmd && s.time === time,
    );
    const fitsDay = serviceFitsWithinOpeningHours(
      hours,
      input.dateYmd,
      time,
      duration,
    );
    const staffList = normalizeStaffMembers(content?.staff);
    const stylist = input.staffName
      ? staffList.find((s) => s.name === input.staffName)
      : null;
    const stylistOk =
      !input.staffName ||
      stylistAcceptsSlot({
        staff: stylist,
        storeWeek: hours.week,
        dateYmd: input.dateYmd,
        startHm: time,
        durationMinutes: duration,
      });
    const taken =
      fitsDay &&
      stylistOk &&
      slotConflicts({
        storeSlug: input.storeSlug,
        dateYmd: input.dateYmd,
        timeHm: time,
        durationMinutes: duration,
        bufferMinutes: hours.bufferTimeMinutes,
        staffName: input.staffName,
        blockedSlots: hours.blockedSlots,
      });
    const tooShort = !fitsDay && !past && !dayBlocked;
    const stylistOff = Boolean(input.staffName) && !stylistOk && !past && !dayBlocked;
    const disabled =
      past || dayBlocked || !fitsDay || !stylistOk || taken || dayFull;
    const reason = past
      ? ("past" as const)
      : dayFull
        ? ("day_full" as const)
        : dayBlocked || slotLocked
          ? ("blocked" as const)
          : stylistOff
            ? ("stylist_off" as const)
            : tooShort
              ? ("too_short" as const)
              : taken
                ? ("booked" as const)
                : ("open" as const);
    const quote = quoteOffPeakDiscount(
      offPeak,
      listAmount,
      input.dateYmd,
      time,
    );
    return {
      time,
      disabled,
      reason,
      label:
        reason === "past"
          ? "已過期"
          : reason === "day_full"
            ? "今日預約已額滿 (Full)"
            : reason === "blocked"
              ? "不可預約"
              : reason === "stylist_off"
                ? "設計師非值班"
                : reason === "too_short"
                  ? `時長不足（需連續 ${duration} 分）`
                  : reason === "booked"
                    ? "已額滿／撞期"
                    : quote.applied
                      ? quote.label
                      : "可預約",
      startsAtLocal: `${input.dateYmd}T${time}`,
      durationMinutes: duration,
      bufferTimeMinutes: hours.bufferTimeMinutes,
      dayFull,
      dayBookingCount: dayCount,
      maxDailyBookings: hours.maxDailyBookingsEnabled
        ? hours.maxDailyBookings
        : null,
      max_daily_bookings: hours.maxDailyBookingsEnabled
        ? hours.maxDailyBookings
        : null,
      offPeakApplied: quote.applied,
      offPeakLabel: quote.label,
      promoCode: quote.promoCode,
      listAmount: quote.listAmount,
      discountAmount: quote.discountAmount,
      payAmount: quote.payAmount,
    };
  });
  return {
    slots,
    dayFull,
    dayBookingCount: dayCount,
    durationMinutes: duration,
    listAmount,
    offPeak: {
      enabled: offPeak.enabled,
      weekdays: offPeak.weekdays,
      start: offPeak.start,
      end: offPeak.end,
      mode: offPeak.mode,
      fixedAmount: offPeak.fixedAmount,
      percentOff: offPeak.percentOff,
      promoCode: offPeak.promoCode || deriveOffPeakPromoCode(offPeak),
    },
    serviceNames: input.serviceNames,
    maxDailyBookings: hours.maxDailyBookingsEnabled
      ? hours.maxDailyBookings
      : null,
    max_daily_bookings: hours.maxDailyBookingsEnabled
      ? hours.maxDailyBookings
      : null,
    maxDailyBookingsEnabled: hours.maxDailyBookingsEnabled,
  };
}

/** 查詢某日可預約時段（已額滿／過去時段標為 disabled） */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const storeSlug = (url.searchParams.get("storeSlug") || "").trim();
  const dateYmd = (url.searchParams.get("date") || "").trim();
  const staffName = (url.searchParams.get("staffName") || "").trim();
  const serviceNames = parseServiceNames(
    url.searchParams.getAll("serviceName").length
      ? url.searchParams.getAll("serviceName")
      : url.searchParams.get("serviceNames") ||
          url.searchParams.get("serviceName") ||
          "",
  );
  const durationOverride = Number(url.searchParams.get("durationMinutes") || "");
  if (!storeSlug || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return NextResponse.json(
      { error: "請提供 storeSlug 與 date（YYYY-MM-DD）" },
      { status: 400 },
    );
  }
  const result = await buildSlots({
    storeSlug,
    dateYmd,
    staffName: staffName || undefined,
    serviceNames,
    durationOverride: Number.isFinite(durationOverride)
      ? durationOverride
      : undefined,
  });
  return NextResponse.json({
    ok: true,
    storeSlug,
    date: dateYmd,
    ...result,
  });
}

type Body = {
  storeSlug?: string;
  storeName?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerLineUserId?: string;
  serviceName?: string;
  /** 多選服務項目（與 serviceName 合併） */
  serviceNames?: string[] | string;
  staffName?: string;
  staffLineUserId?: string;
  /** datetime-local 或 ISO */
  startsAt?: string;
  /** 前端加總後的時長覆寫（分鐘） */
  durationMinutes?: number;
  note?: string;
  referenceImages?: string[];
  termsAccepted?: boolean;
  website?: string;
  /** 手動匯款訂金後五碼 */
  depositBankLastFive?: string;
};

function parseStartsAt(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  // datetime-local（無時區）視為台北時間
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const asTaipei = new Date(`${value}:00+08:00`);
    if (!Number.isNaN(asTaipei.getTime())) return asTaipei;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`booking:${ip}`, 12, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `送出太頻繁，請 ${limited.retryAfterSec} 秒後再試` },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  if (body.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const storeSlug = (body.storeSlug?.trim() || "").slice(0, 80);
  const customerName = (body.customerName?.trim() || "").slice(0, 40);
  const serviceNames = parseServiceNames([
    ...(Array.isArray(body.serviceNames)
      ? body.serviceNames
      : parseServiceNames(body.serviceNames)),
    ...(body.serviceName ? [body.serviceName] : []),
  ]);
  const serviceName = serviceNames.join("、").slice(0, 160);
  const staffName = (body.staffName?.trim() || "").slice(0, 40);
  const note = (body.note?.trim() || "").slice(0, 500);
  const customerEmail = (body.customerEmail?.trim() || "").slice(0, 120);
  const customerLineUserId = (body.customerLineUserId?.trim() || "").slice(0, 80);
  const staffLineUserId = (body.staffLineUserId?.trim() || "").slice(0, 80);
  const phone = normalizeTaiwanMobile(body.customerPhone ?? "");
  const starts = parseStartsAt(body.startsAt ?? "");
  const referenceImages = Array.isArray(body.referenceImages)
    ? body.referenceImages
        .map((u) => String(u || "").trim())
        .filter((u) => /^https?:\/\//i.test(u) || /^data:image\//i.test(u))
        .slice(0, 3)
        .map((u) => u.slice(0, 350_000))
    : [];

  if (!storeSlug) {
    return NextResponse.json({ error: "缺少店家代號" }, { status: 400 });
  }
  if (!customerName) {
    return NextResponse.json({ error: "請填寫姓名" }, { status: 400 });
  }
  if (!isValidTaiwanMobile(phone)) {
    return NextResponse.json(
      { error: "請輸入正確的台灣手機號碼（09 開頭共 10 碼）" },
      { status: 400 },
    );
  }
  if (!serviceNames.length) {
    return NextResponse.json({ error: "請選擇或填寫服務項目" }, { status: 400 });
  }
  if (!starts) {
    return NextResponse.json({ error: "請選擇預約時段" }, { status: 400 });
  }
  if (starts.getTime() < Date.now() - 5 * 60 * 1000) {
    return NextResponse.json({ error: "預約時段不可早於現在" }, { status: 400 });
  }
  if (!body.termsAccepted) {
    return NextResponse.json(
      { error: "請勾選同意店家預約與取消須知" },
      { status: 400 },
    );
  }

  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return NextResponse.json({ error: "Email 格式不正確" }, { status: 400 });
  }

  const [tenant, content] = await Promise.all([
    getTenantDbByStoreId(storeSlug),
    getStoreContent(storeSlug),
  ]);

  if (isTenantBookingSuspended(tenant)) {
    return NextResponse.json(
      {
        error: "系統維護／方案已到期暫停預約，請稍後再試或聯繫店家",
        suspended: true,
        renewUrl: "/dashboard/billing",
      },
      { status: 403 },
    );
  }

  if (
    isBlacklisted({
      phone,
      email: customerEmail,
      userId: customerLineUserId || undefined,
      list: content?.blacklists,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "此電話／帳號已被列入店家黑名單，目前無法透過線上預約，請改以電話聯繫店家",
        blacklisted: true,
      },
      { status: 403 },
    );
  }

  const hours = normalizeBusinessHours(content?.businessHours);
  // 以賣家後台各項目 duration_minutes 加總為準（不信任前端覆寫）
  const durationMinutes = resolveDurationMinutes(content, serviceNames);
  const taipei = toTaipeiDateAndTime(starts.toISOString());
  if (taipei) {
    if (hours.blockedDates.includes(taipei.date)) {
      return NextResponse.json(
        { error: "此日期為店家休假／手動鎖定，不可預約" },
        { status: 409 },
      );
    }
    if (
      !serviceFitsWithinOpeningHours(
        hours,
        taipei.date,
        taipei.time,
        durationMinutes,
      )
    ) {
      return NextResponse.json(
        {
          error: `此時段無法容納連續 ${durationMinutes} 分鐘服務（含多項目加總），請改選更早時段`,
          durationMinutes,
        },
        { status: 409 },
      );
    }
    if (staffName) {
      const stylist = normalizeStaffMembers(content?.staff).find(
        (s) => s.name === staffName,
      );
      if (
        !stylistAcceptsSlot({
          staff: stylist,
          storeWeek: hours.week,
          dateYmd: taipei.date,
          startHm: taipei.time,
          durationMinutes,
        })
      ) {
        return NextResponse.json(
          {
            error: `設計師「${staffName}」此時段未排班或無法容納 ${durationMinutes} 分鐘，請改選其他時間或設計師`,
          },
          { status: 409 },
        );
      }
    }
    if (hours.maxDailyBookingsEnabled) {
      const dayCount = listBookingsForStoreDb(storeSlug).filter((b) => {
        const parts = toTaipeiDateAndTime(b.startsAt);
        return parts?.date === taipei.date;
      }).length;
      if (dayCount >= hours.maxDailyBookings) {
        return NextResponse.json(
          {
            error: "今日預約已額滿 (Full)，請改選其他日期",
            dayFull: true,
            dayBookingCount: dayCount,
            max_daily_bookings: hours.maxDailyBookings,
          },
          { status: 409 },
        );
      }
    }
    if (
      slotConflicts({
        storeSlug,
        dateYmd: taipei.date,
        timeHm: taipei.time,
        durationMinutes,
        bufferMinutes: hours.bufferTimeMinutes,
        staffName: staffName || undefined,
        blockedSlots: hours.blockedSlots,
      })
    ) {
      return NextResponse.json(
        { error: "此時段已額滿或與現有預約重疊，請改選其他時間" },
        { status: 409 },
      );
    }
  }

  const storeName =
    (body.storeName?.trim() ||
      content?.profile?.name?.trim() ||
      tenant?.name?.trim() ||
      storeSlug).slice(0, 80);

  const startsAt = starts.toISOString();
  const now = new Date();
  const staffList = content?.staff;
  const allowedStaff = staffNameOptions(staffList);
  if (staffName && staffName !== "不指定" && !allowedStaff.includes(staffName)) {
    return NextResponse.json({ error: "指定服務人員無效" }, { status: 400 });
  }
  const matchedStaff = (staffList || []).find((s) => s.name === staffName);
  const resolvedStaffLine =
    staffLineUserId || matchedStaff?.lineUserId || undefined;

  const careSettings = normalizeCareRetargeting(content?.careRetargeting);
  const needsCare =
    careSettings.enabled &&
    serviceHasPermOrColorTag({
      serviceName,
      products: content?.profile?.products,
    });
  const careRemindAt = needsCare
    ? computeCareRemindAt(
        startsAt,
        durationMinutes,
        careSettings.daysAfter,
      )
    : null;

  const listAmount = sumServicesListAmount(
    content?.profile?.products,
    serviceNames,
  );
  const offPeakQuote = taipei
    ? quoteOffPeakDiscount(
        content?.offPeakDiscount,
        listAmount,
        taipei.date,
        taipei.time,
      )
    : quoteOffPeakDiscount(null, listAmount, "", "");

  const depositSettings = normalizeDepositSettings(content?.depositSettings);
  // 綠界預付模組暫不開放：僅 none／手動匯款生效，跳過 ECPay
  const effectiveMode =
    depositSettings.mode === "ecpay" && !isEcpayDepositLive(depositSettings)
      ? "none"
      : depositSettings.mode;
  const depositAmount =
    effectiveMode === "none"
      ? 0
      : computeDepositAmount(
          { ...depositSettings, mode: effectiveMode },
          offPeakQuote.payAmount,
        );
  const needsDeposit = effectiveMode !== "none" && depositAmount > 0;
  const bankLastFive = String(body.depositBankLastFive || "")
    .replace(/\D/g, "")
    .slice(0, 5);

  const booking: BookingRecord = {
    id: createBookingId(),
    storeSlug,
    storeName,
    createdAt: now.toISOString(),
    customerName,
    customerPhone: phone,
    customerEmail: customerEmail || undefined,
    customerLineUserId: customerLineUserId || undefined,
    serviceName,
    staffName: staffName || undefined,
    startsAt,
    slotLabel: formatSlotLabel(startsAt),
    durationMinutes,
    listAmount: offPeakQuote.listAmount,
    offPeakDiscountAmount: offPeakQuote.discountAmount,
    payAmount: offPeakQuote.payAmount,
    offPeakApplied: offPeakQuote.applied,
    promoCode: offPeakQuote.applied ? offPeakQuote.promoCode : null,
    note: [
      note,
      `duration:${durationMinutes}`,
      offPeakQuote.applied ? offPeakQuote.detail : "",
    ]
      .filter(Boolean)
      .join(" | ") || undefined,
    referenceImages: referenceImages.length ? referenceImages : undefined,
    remindAt: computeRemindAt(startsAt, now),
    reminderSentAt: null,
    reviewPromptSentAt: null,
    careRemindAt,
    careReminderSentAt: null,
    source: "online",
    status: needsDeposit ? "pending_deposit" : "confirmed",
    depositAmount: needsDeposit ? depositAmount : 0,
    depositStatus: needsDeposit
      ? effectiveMode === "bank_transfer" && bankLastFive.length === 5
        ? "reported"
        : "pending"
      : "none",
    depositMethod: needsDeposit
      ? effectiveMode === "bank_transfer"
        ? "bank_transfer"
        : "none"
      : "none",
    depositBankLastFive:
      needsDeposit && bankLastFive.length === 5 ? bankLastFive : null,
    depositTradeNo: null,
    depositPaidAt: null,
  };

  saveBookingDb(booking);

  try {
    await patchStoreContent(storeSlug, {
      customers: upsertCustomerFromBooking({
        list: content?.customers || [],
        phone,
        email: customerEmail || undefined,
        name: customerName,
      }),
      bookingTerms: normalizeBookingTerms(content?.bookingTerms),
    });
  } catch (error) {
    console.error("[booking-crm]", booking.id, error);
  }

  const sellerEmails = [
    tenant?.ownerEmail?.trim() || "",
    content?.profile?.email?.trim() || "",
  ].filter(Boolean);

  const sellerLineUserIds = resolveSellerLineTargets({
    staffLineUserId: resolvedStaffLine,
    storeLineUserIds: process.env.BOOKING_SELLER_LINE_USER_IDS,
  });

  let notify: Record<string, unknown> = {};
  try {
    notify = await notifyBookingCreated(booking, {
      sellerEmails,
      sellerLineUserIds,
    });
    updateBookingDb(booking.id, {
      sellerNotifiedAt: new Date().toISOString(),
      customerSuccessNotifiedAt:
        customerEmail || customerLineUserId
          ? new Date().toISOString()
          : undefined,
    });
  } catch (error) {
    console.error("[booking-notify]", booking.id, error);
  }

  return NextResponse.json({
    ok: true,
    booking: {
      id: booking.id,
      slotLabel: booking.slotLabel,
      serviceName: booking.serviceName,
      staffName: booking.staffName,
      durationMinutes: booking.durationMinutes,
      listAmount: booking.listAmount,
      offPeakDiscountAmount: booking.offPeakDiscountAmount,
      payAmount: booking.payAmount,
      offPeakApplied: booking.offPeakApplied,
      promoCode: booking.promoCode,
      remindAt: booking.remindAt,
      status: booking.status,
      depositAmount: booking.depositAmount,
      depositStatus: booking.depositStatus,
      depositMethod: booking.depositMethod,
    },
    deposit: needsDeposit
      ? {
          mode: effectiveMode,
          amount: depositAmount,
          bankHint: depositSettings.bankHint,
          checkoutPath: null,
        }
      : null,
    notify,
    message: needsDeposit
      ? bankLastFive.length === 5
        ? "預約已建立，匯款後五碼已送出，待店家對帳確認訂金。"
        : "預約已建立，請依說明完成匯款訂金並回填後五碼。"
      : "預約已送出。顧客將收到成功通知與行前提醒；店家／服務人員已收到即時接單推播（依方案與串接設定）。",
  });
}
