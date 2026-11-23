import {
  sendBookingCustomerReminderEmail,
  sendBookingCustomerReviewEmail,
  sendBookingCustomerSuccessEmail,
  sendBookingSellerEmail,
} from "@/lib/booking-mail";
import type { BookingRecord } from "@/lib/bookings";
import {
  markBookingReminderSentDb,
  updateBookingDb,
} from "@/lib/bookings-db.server";
import {
  parseLineUserIds,
  pushLineImage,
  pushLineText,
  type LinePushResult,
} from "@/lib/line-messaging";
import { reportToHub } from "@/lib/novaos-telemetry";
import { formatBookingDiscountLines } from "@/lib/off-peak-discounts";

function siteBase() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    "https://taiwanbiz.vercel.app"
  );
}

function bookingTextBlock(booking: BookingRecord) {
  const images = (booking.referenceImages || [])
    .slice(0, 3)
    .map((url, i) => {
      if (url.startsWith("data:")) {
        return `參考圖${i + 1}：已上傳（請於後台預約日曆查看預覽）`;
      }
      return `參考圖${i + 1}：${url}`;
    })
    .join("\n");
  const dashboardUrl = `${siteBase()}/dashboard/bookings`;
  const priceLines = formatBookingDiscountLines(booking);
  return [
    `店家：${booking.storeName}`,
    `顧客：${booking.customerName}（${booking.customerPhone}）`,
    `服務：${booking.serviceName}`,
    booking.staffName ? `人員：${booking.staffName}` : "",
    `時段：${booking.slotLabel}`,
    ...priceLines,
    booking.note ? `備註：${booking.note}` : "",
    images,
    `後台查看：${dashboardUrl}`,
    `編號：${booking.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type BookingNotifyTargets = {
  sellerEmails: string[];
  /** 店家／服務人員 LINE userId */
  sellerLineUserIds: string[];
};

export type BookingNotifySummary = {
  ok: boolean;
  results: Record<string, unknown>;
  failures: string[];
};

function isLineFailure(result: LinePushResult) {
  return result.ok === false;
}

async function reportNotifyFailure(
  message: string,
  meta: Record<string, unknown>,
) {
  void reportToHub({
    kind: "notify_failure",
    severity: "warn",
    message,
    meta: { product: "booking", ...meta },
  });
}

function collectFailures(results: Record<string, unknown>): string[] {
  const failures: string[] = [];
  for (const [key, value] of Object.entries(results)) {
    if (!value || typeof value !== "object") continue;
    const row = value as { ok?: boolean; error?: string; skipped?: boolean };
    if (row.ok === false) {
      failures.push(`${key}:${row.error || "failed"}`);
    }
  }
  return failures;
}

/**
 * 預約成立後雙向通知：
 * - 顧客：Email／LINE 預約成功
 * - 店家／服務人員：Email／LINE 即時接單
 * 任一實際送出失敗 → ok=false，並回報 hub telemetry（不宣稱成功）
 */
export async function notifyBookingCreated(
  booking: BookingRecord,
  targets: BookingNotifyTargets,
): Promise<BookingNotifySummary> {
  const results: Record<string, unknown> = {};
  const block = bookingTextBlock(booking);

  for (const email of [...new Set(targets.sellerEmails.map((e) => e.trim()).filter(Boolean))]) {
    try {
      results[`sellerEmail:${email}`] = await sendBookingSellerEmail(email, booking);
    } catch (error) {
      results[`sellerEmail:${email}`] = {
        ok: false,
        error: error instanceof Error ? error.message : "email failed",
      };
    }
  }

  for (const userId of targets.sellerLineUserIds) {
    const lineResult = await pushLineText(
      userId,
      `【新預約接單】\n${block}`,
    );
    results[`sellerLine:${userId}`] = lineResult;
    if (isLineFailure(lineResult)) {
      await reportNotifyFailure(`booking created seller LINE failed: ${lineResult.error}`, {
        bookingId: booking.id,
        storeSlug: booking.storeSlug,
        channel: "line",
        role: "seller",
      });
    }
    for (const [idx, url] of (booking.referenceImages || [])
      .slice(0, 3)
      .entries()) {
      if (!/^https?:\/\//i.test(url)) continue;
      const img = await pushLineImage(userId, url);
      results[`sellerLineImage:${userId}:${idx}`] = img;
      if (isLineFailure(img)) {
        await reportNotifyFailure(`booking created LINE image failed: ${img.error}`, {
          bookingId: booking.id,
          storeSlug: booking.storeSlug,
          channel: "line_image",
        });
      }
    }
  }

  if (booking.customerEmail?.trim()) {
    try {
      results.customerEmail = await sendBookingCustomerSuccessEmail(
        booking.customerEmail.trim(),
        booking,
      );
    } catch (error) {
      results.customerEmail = {
        ok: false,
        error: error instanceof Error ? error.message : "email failed",
      };
    }
  }

  if (booking.customerLineUserId?.trim()) {
    const customerLine = await pushLineText(
      booking.customerLineUserId.trim(),
      `【預約成功】${booking.storeName}\n${block}\n\n請準時到店；行前我們會再提醒您。`,
    );
    results.customerLine = customerLine;
    if (isLineFailure(customerLine)) {
      await reportNotifyFailure(
        `booking created customer LINE failed: ${customerLine.error}`,
        {
          bookingId: booking.id,
          storeSlug: booking.storeSlug,
          channel: "line",
          role: "customer",
        },
      );
    }
  }

  const failures = collectFailures(results);
  if (failures.length) {
    await reportNotifyFailure(
      `booking created notify partial failure (${failures.length})`,
      {
        bookingId: booking.id,
        storeSlug: booking.storeSlug,
        failures,
      },
    );
  }

  return { ok: failures.length === 0, results, failures };
}

/** 行前提醒（顧客 Email／LINE）— 失敗不上報成功、不上標記已送 */
export async function notifyBookingReminder(
  booking: BookingRecord,
): Promise<BookingNotifySummary> {
  const results: Record<string, unknown> = {};
  const block = bookingTextBlock(booking);
  let attempted = false;

  if (booking.customerEmail?.trim()) {
    attempted = true;
    try {
      results.customerEmail = await sendBookingCustomerReminderEmail(
        booking.customerEmail.trim(),
        booking,
      );
    } catch (error) {
      results.customerEmail = {
        ok: false,
        error: error instanceof Error ? error.message : "email failed",
      };
    }
  }

  if (booking.customerLineUserId?.trim()) {
    attempted = true;
    const customerLine = await pushLineText(
      booking.customerLineUserId.trim(),
      `【行前提醒】${booking.storeName}\n您的預約即將到來：\n${block}`,
    );
    results.customerLine = customerLine;
    if (isLineFailure(customerLine)) {
      await reportNotifyFailure(
        `booking reminder LINE failed: ${customerLine.error}`,
        {
          bookingId: booking.id,
          storeSlug: booking.storeSlug,
          channel: "line",
          kind: "reminder",
        },
      );
    }
  }

  if (!attempted) {
    results.skipped = "no-customer-channel";
    // 無通道可送：標記已處理避免 Cron 卡住，但不宣稱推播成功
    markBookingReminderSentDb(booking.id);
    return { ok: true, results, failures: [] };
  }

  const failures = collectFailures(results);
  if (failures.length) {
    await reportNotifyFailure(
      `booking reminder notify failure (${failures.length})`,
      {
        bookingId: booking.id,
        storeSlug: booking.storeSlug,
        failures,
        kind: "reminder",
      },
    );
    // 失敗不標記 reminderSentAt，允許 Cron 重試
    return { ok: false, results, failures };
  }

  markBookingReminderSentDb(booking.id);
  return { ok: true, results, failures: [] };
}

export function resolveSellerLineTargets(input: {
  staffLineUserId?: string | null;
  storeLineUserIds?: string | null;
  envFallback?: string | null;
}) {
  return parseLineUserIds(
    [
      input.staffLineUserId,
      input.storeLineUserIds,
      input.envFallback ?? process.env.BOOKING_SELLER_LINE_USER_IDS,
    ]
      .filter(Boolean)
      .join(","),
  );
}

/** 課後關心＋五星好評／IG 標記導流 */
export async function notifyBookingReviewPrompt(
  booking: BookingRecord,
  opts?: { reviewUrl?: string; igHint?: string },
): Promise<BookingNotifySummary> {
  const results: Record<string, unknown> = {};
  const reviewUrl =
    opts?.reviewUrl?.trim() ||
    process.env.NEXT_PUBLIC_DEFAULT_REVIEW_URL?.trim() ||
    "";
  const igHint =
    opts?.igHint?.trim() ||
    "完成服務後歡迎在 IG 標記本店，私訊截圖可享下次小驚喜優惠。";
  const text = [
    `【服務關心】${booking.storeName}`,
    `您好 ${booking.customerName}，感謝您預約「${booking.serviceName}」。`,
    "希望今天的體驗讓您滿意！若有任何不適或回饋，歡迎直接回覆我們。",
    "",
    "⭐ 五星好評導流",
    igHint,
    reviewUrl ? `Google 商家評論：${reviewUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let attempted = false;
  if (booking.customerLineUserId?.trim()) {
    attempted = true;
    const customerLine = await pushLineText(
      booking.customerLineUserId.trim(),
      text,
    );
    results.customerLine = customerLine;
    if (isLineFailure(customerLine)) {
      await reportNotifyFailure(
        `booking review LINE failed: ${customerLine.error}`,
        {
          bookingId: booking.id,
          storeSlug: booking.storeSlug,
          channel: "line",
          kind: "review",
        },
      );
    }
  }
  if (booking.customerEmail?.trim()) {
    attempted = true;
    try {
      results.customerEmail = await sendBookingCustomerReviewEmail(
        booking.customerEmail.trim(),
        booking,
        { reviewUrl, igHint },
      );
    } catch (error) {
      results.customerEmail = {
        ok: false,
        error: error instanceof Error ? error.message : "email failed",
      };
    }
  }

  if (!attempted) {
    results.skipped = "no-customer-channel";
    updateBookingDb(booking.id, {
      reviewPromptSentAt: new Date().toISOString(),
    });
    return { ok: true, results, failures: [] };
  }

  const failures = collectFailures(results);
  if (failures.length) {
    await reportNotifyFailure(
      `booking review notify failure (${failures.length})`,
      {
        bookingId: booking.id,
        storeSlug: booking.storeSlug,
        failures,
        kind: "review",
      },
    );
    return { ok: false, results, failures };
  }

  updateBookingDb(booking.id, {
    reviewPromptSentAt: new Date().toISOString(),
  });
  return { ok: true, results, failures: [] };
}

/** 燙染後自動護理／回購推播（預設完成後 30 天） */
export async function notifyBookingCareReminder(
  booking: BookingRecord,
  opts?: { messageTemplate?: string },
): Promise<BookingNotifySummary> {
  const results: Record<string, unknown> = {};
  const bookingUrl = `${siteBase()}/stores/${encodeURIComponent(booking.storeSlug)}#booking`;
  const template =
    opts?.messageTemplate?.trim() ||
    "【護理回購提醒】親愛的 {name}，距離您上次「{service}」已約一個月～現在正是保養護理的好時機！點此重新預約：{bookingUrl}";
  const text = template
    .replaceAll("{name}", booking.customerName || "貴賓")
    .replaceAll("{service}", booking.serviceName || "服務")
    .replaceAll("{store}", booking.storeName || "")
    .replaceAll("{bookingUrl}", bookingUrl)
    .slice(0, 900);

  let attempted = false;
  if (booking.customerLineUserId?.trim()) {
    attempted = true;
    const customerLine = await pushLineText(
      booking.customerLineUserId.trim(),
      text,
    );
    results.customerLine = customerLine;
    if (isLineFailure(customerLine)) {
      await reportNotifyFailure(
        `booking care LINE failed: ${customerLine.error}`,
        {
          bookingId: booking.id,
          storeSlug: booking.storeSlug,
          channel: "line",
          kind: "care",
        },
      );
    }
  }
  if (booking.customerEmail?.trim()) {
    attempted = true;
    try {
      results.customerEmail = await sendBookingCustomerReviewEmail(
        booking.customerEmail.trim(),
        {
          ...booking,
          note: text,
        },
        {
          reviewUrl: bookingUrl,
          igHint: "護理回購提醒｜點連結重新預約",
        },
      );
    } catch (error) {
      results.customerEmail = {
        ok: false,
        error: error instanceof Error ? error.message : "email failed",
      };
    }
  }
  if (!attempted) {
    results.skipped = "no-customer-channel";
    updateBookingDb(booking.id, {
      careReminderSentAt: new Date().toISOString(),
    });
    return { ok: true, results, failures: [] };
  }

  const failures = collectFailures(results);
  if (failures.length) {
    await reportNotifyFailure(
      `booking care notify failure (${failures.length})`,
      {
        bookingId: booking.id,
        storeSlug: booking.storeSlug,
        failures,
        kind: "care",
      },
    );
    return { ok: false, results, failures };
  }

  updateBookingDb(booking.id, {
    careReminderSentAt: new Date().toISOString(),
  });
  return { ok: true, results, failures: [] };
}
