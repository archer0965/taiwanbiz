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
 * 行前提醒＋課後關心／五星好評導流
 * （服務當日 20:00 或晚間檔次次日 10:00，台北時區）
 * Vercel Cron：GET /api/cron/booking-reminders
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
      results.push({ id: booking.id, ok: true, detail });
    } catch (error) {
      console.error("[booking-reminders]", booking.id, error);
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
      reviewResults.push({ id: booking.id, ok: true, detail });
    } catch (error) {
      console.error("[booking-review-prompt]", booking.id, error);
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
        // 店家已關閉：標記已處理避免重試
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
      careResults.push({ id: booking.id, ok: true, detail });
    } catch (error) {
      console.error("[booking-care-reminder]", booking.id, error);
      careResults.push({
        id: booking.id,
        ok: false,
        detail: error instanceof Error ? error.message : "failed",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dueCount: due.length,
    results,
    reviewDueCount: reviewDue.length,
    reviewResults,
    careDueCount: careDue.length,
    careResults,
  });
}
