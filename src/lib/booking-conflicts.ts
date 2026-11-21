/**
 * 預約時段衝突：同一設計師不可重疊；取消後自動釋放。
 * 供前台 POST /api/booking、時段查詢 GET、以及賣家手動新增共用。
 */
import type { BookingRecord } from "@/lib/bookings";
import { toTaipeiDateAndTime } from "@/lib/bookings";
import {
  bookingOccupiedRangeMinutes,
  clampDurationMinutes,
  rangesOverlap,
} from "@/lib/business-hours";

export function readBookingDurationMinutes(booking: BookingRecord) {
  if (
    typeof booking.durationMinutes === "number" &&
    Number.isFinite(booking.durationMinutes)
  ) {
    return clampDurationMinutes(booking.durationMinutes);
  }
  const fromNote = Number(booking.note?.match(/duration:(\d+)/)?.[1]);
  return clampDurationMinutes(fromNote || 60);
}

/** 是否與既有預約／手動鎖定重疊（cancelled 不佔用） */
export function slotConflicts(input: {
  bookings: BookingRecord[];
  dateYmd: string;
  timeHm: string;
  durationMinutes: number;
  bufferMinutes: number;
  staffName?: string;
  blockedSlots: Array<{ date: string; time: string }>;
  /** 更新既有預約時可排除自身 */
  excludeBookingId?: string;
}) {
  const proposed = bookingOccupiedRangeMinutes(
    input.timeHm,
    input.durationMinutes,
    input.bufferMinutes,
  );

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

  const staffFilter =
    input.staffName && input.staffName !== "不指定" ? input.staffName : null;

  return input.bookings.some((b) => {
    if (input.excludeBookingId && b.id === input.excludeBookingId) return false;
    // 取消後自動釋放時段：cancelled 不佔用衝突檢查
    if ((b.status || "confirmed") === "cancelled") return false;
    const parts = toTaipeiDateAndTime(b.startsAt);
    if (!parts || parts.date !== input.dateYmd) return false;
    // 指定設計師：僅與同設計師（或未指定人員的舊預約）互斥
    if (staffFilter) {
      if (b.staffName && b.staffName !== staffFilter) return false;
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
