import { auth } from "@/auth";
import {
  applyBookingStatusToCustomerCrm,
  createBlacklistEntry,
  isBlacklisted,
  normalizeBlacklists,
  upsertCustomerFromBooking,
} from "@/lib/beauty-ops";
import {
  computeRemindAt,
  createBookingId,
  formatSlotLabel,
  resolveBookingStatus,
  toTaipeiDateAndTime,
  type BookingRecord,
  type BookingSource,
  type BookingStatus,
} from "@/lib/bookings";
import {
  listBookingsForStoreDb,
  saveBookingDb,
  updateBookingDb,
} from "@/lib/bookings-db.server";
import {
  normalizeBusinessHours,
} from "@/lib/business-hours";
import {
  isValidTaiwanMobile,
  normalizeTaiwanMobile,
} from "@/lib/phone";
import { isDeveloperEmail } from "@/lib/roles";
import {
  getStoreContent,
  patchStoreContent,
} from "@/lib/store-content-db.server";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { NextResponse } from "next/server";

type Props = {
  params: Promise<{ slug: string }>;
};

async function assertStoreOwner(slug: string, email: string) {
  if (isDeveloperEmail(email)) return true;
  const tenant = await getTenantDbByStoreId(slug);
  if (!tenant) return false;
  return tenant.ownerEmail.trim().toLowerCase() === email.trim().toLowerCase();
}

function bookingOnDate(b: BookingRecord, dateYmd: string) {
  try {
    const local = new Date(b.startsAt).toLocaleDateString("en-CA", {
      timeZone: "Asia/Taipei",
    });
    return local === dateYmd;
  } catch {
    return b.startsAt.startsWith(dateYmd);
  }
}

/** 賣家：列出本店預約（含備註／參考圖／封鎖時段） */
export async function GET(request: Request, { params }: Props) {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const storeSlug = slug.trim().toLowerCase();
  if (!(await assertStoreOwner(storeSlug, email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const date = (url.searchParams.get("date") || "").trim();
  const from = (url.searchParams.get("from") || "").trim();
  const to = (url.searchParams.get("to") || "").trim();

  let bookings = listBookingsForStoreDb(storeSlug).sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );

  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    bookings = bookings.filter((b) => {
      const parts = toTaipeiDateAndTime(b.startsAt);
      if (!parts) return false;
      return parts.date >= from && parts.date <= to;
    });
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    bookings = bookings.filter((b) => bookingOnDate(b, date));
  }

  const content = await getStoreContent(storeSlug);
  const blacklists = normalizeBlacklists(content?.blacklists);
  const hours = normalizeBusinessHours(content?.businessHours);

  let blockedSlots = hours.blockedSlots;
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    blockedSlots = blockedSlots.filter((s) => s.date >= from && s.date <= to);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    blockedSlots = blockedSlots.filter((s) => s.date === date);
  }

  return NextResponse.json({
    ok: true,
    storeSlug,
    date: date || null,
    from: from || null,
    to: to || null,
    blockedSlots,
    businessHours: hours,
    staff: content?.staff || [],
    products: content?.profile?.products || [],
    bookings: bookings.map((b) => ({
      ...b,
      status: resolveBookingStatus(b),
      blacklisted: isBlacklisted({
        phone: b.customerPhone,
        email: b.customerEmail,
        userId: b.customerLineUserId,
        list: blacklists,
      }),
    })),
  });
}

/** 賣家：黑名單／手動預約／封鎖時段／狀態／訂金對帳 */
export async function POST(request: Request, { params }: Props) {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const storeSlug = slug.trim().toLowerCase();
  if (!(await assertStoreOwner(storeSlug, email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action || "");

  if (action === "blacklist") {
    return handleBlacklist(storeSlug, body);
  }
  if (action === "unblacklist") {
    return handleUnblacklist(storeSlug, body);
  }
  if (action === "manual_booking") {
    return handleManualBooking(storeSlug, body);
  }
  if (action === "block_slot") {
    return handleBlockSlot(storeSlug, body, true);
  }
  if (action === "unblock_slot") {
    return handleBlockSlot(storeSlug, body, false);
  }
  if (action === "update_status") {
    return handleUpdateStatus(storeSlug, body);
  }
  if (action === "confirm_deposit") {
    return handleConfirmDeposit(storeSlug, body);
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}

async function handleBlacklist(
  storeSlug: string,
  body: Record<string, unknown>,
) {
  const phone = String(body.phone || "").replace(/\D/g, "");
  const customerEmail = String(body.email || "")
    .trim()
    .toLowerCase();
  const userId = String(body.userId || "").trim();
  const reason = String(body.reason || "").trim();
  const sourceBookingId = String(body.bookingId || "").trim() || undefined;

  if (!phone && !customerEmail && !userId) {
    return NextResponse.json(
      { error: "請提供 phone、email 或 user_id" },
      { status: 400 },
    );
  }

  const content = await getStoreContent(storeSlug);
  const current = normalizeBlacklists(content?.blacklists);
  if (
    isBlacklisted({
      phone,
      email: customerEmail,
      userId,
      list: current,
    })
  ) {
    return NextResponse.json({
      ok: true,
      already: true,
      message: "此顧客已在黑名單中",
      blacklists: current,
    });
  }

  const entry = createBlacklistEntry({
    phone: phone || undefined,
    email: customerEmail || undefined,
    userId: userId || undefined,
    reason: reason || "防放鳥／違規",
    sourceBookingId,
  });
  const next = [entry, ...current].slice(0, 2000);
  await patchStoreContent(storeSlug, { blacklists: next });

  return NextResponse.json({
    ok: true,
    entry,
    blacklists: next,
    message: "已加入黑名單，該電話／Email 將無法線上預約",
  });
}

async function handleUnblacklist(
  storeSlug: string,
  body: Record<string, unknown>,
) {
  const phone = String(body.phone || "").replace(/\D/g, "");
  const customerEmail = String(body.email || "")
    .trim()
    .toLowerCase();
  const userId = String(body.userId || "").trim();
  const entryId = String(body.entryId || "").trim();

  const content = await getStoreContent(storeSlug);
  const current = normalizeBlacklists(content?.blacklists);
  const next = current.filter((b) => {
    if (entryId && b.id === entryId) return false;
    if (phone && b.phone === phone) return false;
    if (customerEmail && b.email === customerEmail) return false;
    if (userId && b.userId === userId) return false;
    return true;
  });
  await patchStoreContent(storeSlug, { blacklists: next });
  return NextResponse.json({
    ok: true,
    blacklists: next,
    message: "已自黑名單移除，可再次線上預約",
  });
}

async function handleManualBooking(
  storeSlug: string,
  body: Record<string, unknown>,
) {
  const customerName = String(body.customerName || "").trim().slice(0, 40);
  const phoneRaw = String(body.customerPhone || "");
  const phone = normalizeTaiwanMobile(phoneRaw);
  const serviceName = String(body.serviceName || "現場服務")
    .trim()
    .slice(0, 120);
  const staffName = String(body.staffName || "").trim().slice(0, 40);
  const dateYmd = String(body.date || "").trim();
  const timeHm = String(body.time || "").trim();
  const durationMinutes = Math.max(
    15,
    Math.min(480, Math.round(Number(body.durationMinutes) || 60)),
  );
  const note = String(body.note || "").trim().slice(0, 500);
  const source: BookingSource =
    body.source === "walk_in" ? "walk_in" : "manual";

  if (!customerName) {
    return NextResponse.json({ error: "請填寫顧客姓名" }, { status: 400 });
  }
  if (!isValidTaiwanMobile(phone)) {
    return NextResponse.json(
      { error: "請輸入正確的台灣手機號碼" },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || !/^\d{2}:\d{2}$/.test(timeHm)) {
    return NextResponse.json({ error: "請選擇有效日期與時段" }, { status: 400 });
  }

  const content = await getStoreContent(storeSlug);
  const tenant = await getTenantDbByStoreId(storeSlug);
  const startsAt = new Date(`${dateYmd}T${timeHm}:00+08:00`).toISOString();
  const now = new Date();

  const booking: BookingRecord = {
    id: createBookingId(),
    storeSlug,
    storeName: content?.profile?.name || tenant?.name || storeSlug,
    createdAt: now.toISOString(),
    customerName,
    customerPhone: phone,
    serviceName,
    staffName: staffName || undefined,
    startsAt,
    slotLabel: formatSlotLabel(startsAt),
    durationMinutes,
    note: note || undefined,
    remindAt: computeRemindAt(startsAt, now),
    reminderSentAt: null,
    status: "confirmed",
    source,
    depositAmount: 0,
    depositStatus: "none",
    depositMethod: "none",
  };

  saveBookingDb(booking);
  await patchStoreContent(storeSlug, {
    customers: upsertCustomerFromBooking({
      list: content?.customers || [],
      phone,
      name: customerName,
      bookedAt: startsAt,
    }),
  });

  return NextResponse.json({
    ok: true,
    booking,
    message:
      source === "walk_in" ? "已新增現場客預約" : "已手動新增預約",
  });
}

async function handleBlockSlot(
  storeSlug: string,
  body: Record<string, unknown>,
  block: boolean,
) {
  const dateYmd = String(body.date || "").trim();
  const timeHm = String(body.time || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || !/^\d{2}:\d{2}$/.test(timeHm)) {
    return NextResponse.json({ error: "請選擇有效日期與時段" }, { status: 400 });
  }

  const content = await getStoreContent(storeSlug);
  const hours = normalizeBusinessHours(content?.businessHours);
  let blockedSlots = [...hours.blockedSlots];
  const exists = blockedSlots.some(
    (s) => s.date === dateYmd && s.time === timeHm,
  );

  if (block) {
    if (!exists) blockedSlots.push({ date: dateYmd, time: timeHm });
  } else {
    blockedSlots = blockedSlots.filter(
      (s) => !(s.date === dateYmd && s.time === timeHm),
    );
  }

  // 支援一次封鎖多個連續時段
  const times = Array.isArray(body.times)
    ? (body.times as unknown[])
        .map((t) => String(t))
        .filter((t) => /^\d{2}:\d{2}$/.test(t))
    : [];
  if (block && times.length) {
    for (const t of times) {
      if (!blockedSlots.some((s) => s.date === dateYmd && s.time === t)) {
        blockedSlots.push({ date: dateYmd, time: t });
      }
    }
  }

  const nextHours = { ...hours, blockedSlots };
  await patchStoreContent(storeSlug, { businessHours: nextHours });

  return NextResponse.json({
    ok: true,
    blockedSlots,
    message: block ? "已封鎖此時段" : "已解除封鎖",
  });
}

async function handleUpdateStatus(
  storeSlug: string,
  body: Record<string, unknown>,
) {
  const bookingId = String(body.bookingId || "").trim();
  const status = String(body.status || "") as BookingStatus;
  const allowed: BookingStatus[] = [
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
    "pending_deposit",
  ];
  if (!bookingId || !allowed.includes(status)) {
    return NextResponse.json({ error: "無效的狀態" }, { status: 400 });
  }

  const existing = listBookingsForStoreDb(storeSlug).find(
    (b) => b.id === bookingId,
  );
  if (!existing) {
    return NextResponse.json({ error: "找不到預約" }, { status: 404 });
  }

  const prev = resolveBookingStatus(existing);
  const updated = updateBookingDb(bookingId, { status });
  if (!updated) {
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }

  const content = await getStoreContent(storeSlug);
  await patchStoreContent(storeSlug, {
    customers: applyBookingStatusToCustomerCrm({
      list: content?.customers || [],
      phone: existing.customerPhone,
      prevStatus: prev,
      nextStatus: status,
    }),
  });

  return NextResponse.json({
    ok: true,
    booking: updated,
    message: `已更新為 ${status}`,
  });
}

async function handleConfirmDeposit(
  storeSlug: string,
  body: Record<string, unknown>,
) {
  const bookingId = String(body.bookingId || "").trim();
  const existing = listBookingsForStoreDb(storeSlug).find(
    (b) => b.id === bookingId,
  );
  if (!existing) {
    return NextResponse.json({ error: "找不到預約" }, { status: 404 });
  }
  const updated = updateBookingDb(bookingId, {
    depositStatus: "paid",
    depositPaidAt: new Date().toISOString(),
    status:
      existing.status === "pending_deposit" ? "confirmed" : existing.status,
  });
  return NextResponse.json({
    ok: true,
    booking: updated,
    message: "已確認訂金入帳",
  });
}
