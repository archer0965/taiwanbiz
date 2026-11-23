import { normalizeCareRetargeting } from "@/lib/beauty-ops";
import {
  listBookingsDueForCareReminderDb,
  listBookingsDueForReminderDb,
  listBookingsDueForReviewPromptDb,
} from "@/lib/bookings-db.server";
import {
  notifyBookingCareReminder,
  notifyBookingReminder,
  notifyBookingReviewPrompt,
} from "@/lib/booking-notify";
import { reportToHub } from "@/lib/novaos-telemetry";
import { getStoreContent } from "@/lib/store-content-db.server";
import { NextResponse } from "next/server";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production"
    ) {
      return false;
    }
    const host = request.headers.get("host") || "";
    return host.includes("localhost") || host.startsWith("127.0.0.1");
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const query = new URL(request.url).searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}

/**
 * 顧客預約行前提醒＋課後關心／五星好評導流
 * 工作路徑：booking.remindAt（建立時 computeRemindAt）→ 本 Cron 掃描
 * listBookingsDueForReminderDb → notifyBookingReminder（Email／LINE）
 * → markBookingReminderSentDb（僅送達成功時）。已取消預約不會進入到期清單。
 * 推播失敗回報 hub telemetry，且 ok=false（不宣稱成功）。
 * Vercel Cron：GET /api/cron/booking-reminders（vercel.json）
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = listBookingsDueForReminderDb(new Date());
  const results: Array<{ id: string; ok: boolean; detail?: unknown }> = [];

  for (const booking of due) {
    try {
      const detail = await notifyBookingReminder(booking);
      results.push({
        id: booking.id,
        ok: detail.ok,
        detail: detail.results,
      });
      if (!detail.ok) {
        void reportToHub({
          kind: "notify_failure",
          severity: "warn",
          message: `cron booking-reminder failed for ${booking.id}`,
          meta: {
            bookingId: booking.id,
            storeSlug: booking.storeSlug,
            failures: detail.failures,
          },
        });
      }
    } catch (error) {
      console.error("[booking-reminders]", booking.id, error);
      void reportToHub({
        kind: "notify_failure",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "booking-reminder cron exception",
        meta: { bookingId: booking.id, storeSlug: booking.storeSlug },
      });
      results.push({
        id: booking.id,
        ok: false,
        detail: error instanceof Error ? error.message : "failed",
      });
    }
  }

  const reviewDue = listBookingsDueForReviewPromptDb(new Date());
  const reviewResults: Array<{ id: string; ok: boolean; detail?: unknown }> =
    [];
  for (const booking of reviewDue) {
    try {
      const content = await getStoreContent(booking.storeSlug);
      const detail = await notifyBookingReviewPrompt(booking, {
        reviewUrl: content?.reviewUrl,
        igHint: content?.reviewIgHint,
      });
      reviewResults.push({
        id: booking.id,
        ok: detail.ok,
        detail: detail.results,
      });
    } catch (error) {
      console.error("[booking-review-prompt]", booking.id, error);
      void reportToHub({
        kind: "notify_failure",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "booking-review cron exception",
        meta: { bookingId: booking.id },
      });
      reviewResults.push({
        id: booking.id,
        ok: false,
        detail: error instanceof Error ? error.message : "failed",
      });
    }
  }

  const careDue = listBookingsDueForCareReminderDb(new Date());
  const careResults: Array<{ id: string; ok: boolean; detail?: unknown }> = [];
  for (const booking of careDue) {
    try {
      const content = await getStoreContent(booking.storeSlug);
      const care = normalizeCareRetargeting(content?.careRetargeting);
      if (!care.enabled) {
        const { updateBookingDb } = await import("@/lib/bookings-db.server");
        updateBookingDb(booking.id, {
          careReminderSentAt: new Date().toISOString(),
        });
        careResults.push({ id: booking.id, ok: true, detail: "disabled" });
        continue;
      }
      const detail = await notifyBookingCareReminder(booking, {
        messageTemplate: care.message,
      });
      careResults.push({
        id: booking.id,
        ok: detail.ok,
        detail: detail.results,
      });
    } catch (error) {
      console.error("[booking-care-reminder]", booking.id, error);
      void reportToHub({
        kind: "notify_failure",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "booking-care cron exception",
        meta: { bookingId: booking.id },
      });
      careResults.push({
        id: booking.id,
        ok: false,
        detail: error instanceof Error ? error.message : "failed",
      });
    }
  }

  const anyFail =
    results.some((r) => !r.ok) ||
    reviewResults.some((r) => !r.ok) ||
    careResults.some((r) => !r.ok);

  return NextResponse.json({
    ok: !anyFail,
    dueCount: due.length,
    results,
    reviewDueCount: reviewDue.length,
    reviewResults,
    careDueCount: careDue.length,
    careResults,
  });
}
