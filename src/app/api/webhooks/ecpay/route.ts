import { listBookingsDb, updateBookingDb } from "@/lib/bookings-db.server";
import { verifyCheckMacValue } from "@/lib/ecpay";
import { notifyShopSellerNewOrder } from "@/lib/notify-shop-seller";
import {
  getShopOrderByTradeNo,
  markShopOrderPaid,
  patchShopOrder,
} from "@/lib/shop-orders-db.server";
import { handlePaymentWebhook } from "@/lib/subscription-billing";
import { toTenantDbRow } from "@/lib/tenants";
import { NextResponse } from "next/server";

export const instant = false;

type EcpayPayload = Record<string, string> & {
  storeId?: string;
  store_id?: string;
  CustomField1?: string;
  RtnCode?: string | number;
  MerchantMemberID?: string;
  MerchantTradeNo?: string;
  CheckMacValue?: string;
  mock?: boolean | string;
};

function parseForm(text: string) {
  const params = new URLSearchParams(text);
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

function asStringRecord(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
}

/**
 * 綠界付款結果回調（ReturnURL / PeriodReturnURL / OrderResultURL）
 * - 驗證 CheckMacValue
 * - RtnCode == 1：storeId → Active，並設定下次扣款／到期日
 * - 回應純文字 1|OK（綠界規範）
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let payload: EcpayPayload = {};

  try {
    if (contentType.includes("application/json")) {
      payload = asStringRecord(
        (await request.json()) as Record<string, unknown>,
      ) as EcpayPayload;
    } else {
      const text = await request.text();
      payload = parseForm(text) as EcpayPayload;
    }
  } catch {
    return new NextResponse("0|ParseError", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const storeId = (
    payload.storeId ||
    payload.store_id ||
    payload.CustomField1 ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!storeId) {
    return new NextResponse("0|MissingStoreId", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const isMock =
    payload.mock === true ||
    payload.mock === "true" ||
    process.env.ECPAY_FORCE_MOCK === "true" ||
    !process.env.ECPAY_HASH_KEY?.trim();

  if (!isMock) {
    if (!payload.CheckMacValue) {
      return new NextResponse("0|MissingCheckMacValue", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const valid = verifyCheckMacValue(payload);
    if (!valid) {
      return new NextResponse("0|CheckMacValueInvalid", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  const rtn = String(payload.RtnCode ?? "");
  const success = rtn === "1";
  const tradeNo = payload.MerchantTradeNo || "";
  const isBookingDeposit =
    payload.CustomField2 === "booking_deposit" || tradeNo.startsWith("BD");

  // 預約訂金（綠界／LINE Pay 等）
  if (isBookingDeposit) {
    const bookingId = payload.CustomField3 || "";
    if (success) {
      const hit =
        listBookingsDb().find(
          (b) =>
            b.id === bookingId ||
            (tradeNo && b.depositTradeNo === tradeNo),
        ) || null;
      if (hit) {
        updateBookingDb(hit.id, {
          depositStatus: "paid",
          depositPaidAt: new Date().toISOString(),
          depositTradeNo: tradeNo || hit.depositTradeNo,
          depositMethod: "ecpay",
          status:
            hit.status === "pending_deposit" ? "confirmed" : hit.status,
        });
      } else {
        console.error("[ecpay-webhook] booking deposit not found", tradeNo);
      }
    }
    if (contentType.includes("application/json") && isMock) {
      return NextResponse.json({
        ok: true,
        kind: "booking_deposit",
        storeId,
        tradeNo,
        success,
        bookingId,
        reply: "1|OK",
      });
    }
    return new NextResponse("1|OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const isShopOrder =
    payload.CustomField2 === "shop" || tradeNo.startsWith("PS");

  // Pulse Shop 顧客訂單付款結果
  if (isShopOrder) {
    if (success) {
      const before = tradeNo ? await getShopOrderByTradeNo(tradeNo) : null;
      const wasPending = before?.status === "pending_payment";
      const paid =
        (await markShopOrderPaid(tradeNo)) ||
        (payload.CustomField3
          ? await patchShopOrder(storeId, payload.CustomField3, {
              status: "paid",
              paidAt: new Date().toISOString(),
              tradeNo,
            })
          : null);
      if (!paid) {
        // 仍 ACK，避免綠界重試風暴；可從對帳補單
        console.error("[ecpay-webhook] shop order not found", tradeNo);
      } else if (wasPending) {
        // 線上付款成功才通知賣家（避免待付款重複通知）
        await notifyShopSellerNewOrder(paid);
      }
    } else if (payload.CustomField3) {
      await patchShopOrder(storeId, payload.CustomField3, {
        status: "cancelled",
      });
    }

    if (contentType.includes("application/json") && isMock) {
      return NextResponse.json({
        ok: true,
        kind: "shop",
        storeId,
        tradeNo,
        success,
        order: tradeNo ? await getShopOrderByTradeNo(tradeNo) : null,
        reply: "1|OK",
      });
    }
    return new NextResponse("1|OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const handled = await handlePaymentWebhook({
    storeId,
    result: success ? "success" : "failed",
    merchantMemberId: payload.MerchantMemberID || undefined,
    tradeNo: payload.MerchantTradeNo,
  });

  if (!handled.ok) {
    return new NextResponse("0|StoreNotFound", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 綠界背景通知期待純文字 1|OK；JSON 僅供本機／模擬測試
  if (contentType.includes("application/json") && isMock) {
    return NextResponse.json({
      ok: true,
      result: handled.result,
      message: handled.message,
      schema: handled.tenant ? toTenantDbRow(handled.tenant) : null,
      tenant: handled.tenant,
      reply: "1|OK",
    });
  }

  return new NextResponse("1|OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** 部分瀏覽器導回可能使用 GET */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || url.searchParams.get("CustomField1");
  if (storeId) {
    return NextResponse.redirect(
      new URL(
        `/pricing?billing=return&storeId=${encodeURIComponent(storeId)}`,
        request.url,
      ),
    );
  }
  return NextResponse.redirect(new URL("/pricing?billing=return", request.url));
}
