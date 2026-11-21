import { listBookingsDb, updateBookingDb } from "@/lib/bookings-db.server";
import {
  ECPAY_DEPOSIT_MODULE_ENABLED,
  isEcpayDepositLive,
  normalizeDepositSettings,
} from "@/lib/deposit-settings";
import { getStoreContent } from "@/lib/store-content-db.server";
import { NextResponse } from "next/server";

/**
 * 預約訂金 API
 * - report_bank：手動匯款後五碼（可用）
 * - 綠界結帳：模組審核中，一律拒絕觸發 ECPay SDK
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId = String(body.bookingId || "").trim();
  if (!bookingId) {
    return NextResponse.json({ error: "缺少 bookingId" }, { status: 400 });
  }

  const booking = listBookingsDb().find((b) => b.id === bookingId) || null;
  if (!booking) {
    return NextResponse.json({ error: "找不到預約" }, { status: 404 });
  }

  const content = await getStoreContent(booking.storeSlug);
  const settings = normalizeDepositSettings(content?.depositSettings);

  // 匯款後五碼回報（輕量流程，不經綠界）
  if (body.action === "report_bank" || body.depositBankLastFive) {
    const lastFive = String(body.depositBankLastFive || "")
      .replace(/\D/g, "")
      .slice(0, 5);
    if (lastFive.length !== 5) {
      return NextResponse.json(
        { error: "請填寫 5 碼匯款帳號後五碼" },
        { status: 400 },
      );
    }
    const updated = updateBookingDb(bookingId, {
      depositBankLastFive: lastFive,
      depositStatus: "reported",
      depositMethod: "bank_transfer",
    });
    return NextResponse.json({
      ok: true,
      booking: updated,
      message: "已送出匯款後五碼，待店家對帳",
    });
  }

  // 綠界／LINE Pay：預留架構，暫不開放
  if (!ECPAY_DEPOSIT_MODULE_ENABLED || !isEcpayDepositLive(settings)) {
    return NextResponse.json(
      {
        error: "綠界／LINE Pay 預付訂金模組審核中，暫不開放線上刷卡",
        code: "ECPAY_DEPOSIT_COMING_SOON",
        deposit_enabled: false,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: "綠界訂金尚未啟用",
      code: "ECPAY_DEPOSIT_DISABLED",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const bookingId = new URL(request.url).searchParams.get("bookingId") || "";
  if (!bookingId) {
    return NextResponse.json({ error: "缺少 bookingId" }, { status: 400 });
  }
  const booking = listBookingsDb().find((b) => b.id === bookingId);
  if (!booking) {
    return NextResponse.json({ error: "找不到預約" }, { status: 404 });
  }
  const content = await getStoreContent(booking.storeSlug);
  const settings = normalizeDepositSettings(content?.depositSettings);
  return NextResponse.json({
    ok: true,
    booking: {
      id: booking.id,
      storeSlug: booking.storeSlug,
      depositAmount: booking.depositAmount,
      depositStatus: booking.depositStatus,
      depositMethod: booking.depositMethod,
      status: booking.status,
      slotLabel: booking.slotLabel,
    },
    depositSettings: settings,
    ecpayModuleEnabled: ECPAY_DEPOSIT_MODULE_ENABLED,
    ecpayLive: isEcpayDepositLive(settings),
  });
}
