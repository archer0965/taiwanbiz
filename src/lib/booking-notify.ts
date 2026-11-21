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
} from "@/lib/line-messaging";
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

/**
 * 預約成立後雙向通知：
 * - 顧客：Email／LINE 預約成功
 * - 店家／服務人員：Email／LINE 即時接單
 */
export async function notifyBookingCreated(
  booking: BookingRecord,
  targets: BookingNotifyTargets,
) {
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
    results[`sellerLine:${userId}`] = await pushLineText(
      userId,
      `【新預約接單】\n${block}`,
    );
    // https 參考圖另外推播預覽
    for (const [idx, url] of (booking.referenceImages || [])
      .slice(0, 3)
      .entries()) {
      if (!/^https?:\/\//i.test(url)) continue;
      results[`sellerLineImage:${userId}:${idx}`] = await pushLineImage(
        userId,
        url,
      );
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
    results.customerLine = await pushLineText(
      booking.customerLineUserId.trim(),
      `【預約成功】${booking.storeName}\n${block}\n\n請準時到店；行前我們會再提醒您。`,
    );
  }

  return results;
}

/** 行前提醒（顧客 Email／LINE） */
export async function notifyBookingReminder(booking: BookingRecord) {
  const results: Record<string, unknown> = {};
  const block = bookingTextBlock(booking);

  if (booking.customerEmail?.trim()) {
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
    results.customerLine = await pushLineText(
      booking.customerLineUserId.trim(),
      `【行前提醒】${booking.storeName}\n您的預約即將到來：\n${block}`,
    );
  }

  markBookingReminderSentDb(booking.id);
  return results;
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
) {
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

  let delivered = false;
  if (booking.customerLineUserId?.trim()) {
    results.customerLine = await pushLineText(
      booking.customerLineUserId.trim(),
      text,
    );
    delivered = true;
  }
  if (booking.customerEmail?.trim()) {
    try {
      results.customerEmail = await sendBookingCustomerReviewEmail(
        booking.customerEmail.trim(),
        booking,
        { reviewUrl, igHint },
      );
      delivered = true;
    } catch (error) {
      results.customerEmail = {
        ok: false,
        error: error instanceof Error ? error.message : "email failed",
      };
    }
  }

  // 無顧客聯絡方式時仍標記已處理，避免 Cron 重複卡住
  if (!delivered) {
    results.skipped = "no-customer-channel";
  }

  updateBookingDb(booking.id, {
    reviewPromptSentAt: new Date().toISOString(),
  });
  return results;
}

/** 燙染後自動護理／回購推播（預設完成後 30 天） */
export async function notifyBookingCareReminder(
  booking: BookingRecord,
  opts?: { messageTemplate?: string },
) {
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

  let delivered = false;
  if (booking.customerLineUserId?.trim()) {
    results.customerLine = await pushLineText(
      booking.customerLineUserId.trim(),
      text,
    );
    delivered = true;
  }
  if (booking.customerEmail?.trim()) {
    try {
      // 複用課後關心信通道：主旨改為護理提醒
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
      delivered = true;
    } catch (error) {
      results.customerEmail = {
        ok: false,
        error: error instanceof Error ? error.message : "email failed",
      };
    }
  }
  if (!delivered) {
    results.skipped = "no-customer-channel";
  }

  updateBookingDb(booking.id, {
    careReminderSentAt: new Date().toISOString(),
  });
  return results;
}
