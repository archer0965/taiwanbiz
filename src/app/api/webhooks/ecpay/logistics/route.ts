import { verifyLogisticsCheckMacValue } from "@/lib/ecpay";
import { resolveOrderPatchFromLogistics } from "@/lib/logistics-status";
import {
  getShopOrderByLogisticsId,
  getShopOrderByTradeNo,
  patchShopOrder,
} from "@/lib/shop-orders-db.server";
import type { ShopOrderStatus } from "@/lib/store-content";
import { NextResponse } from "next/server";

export const instant = false;

/**
 * 綠界物流狀態通知（Express/Create 的 ServerReplyURL）
 * 成功須回傳 1|OK
 */
export async function POST(request: Request) {
  const fields: Record<string, string> = {};
  try {
    const text = await request.text();
    new URLSearchParams(text).forEach((v, k) => {
      fields[k] = v;
    });
  } catch {
    return new NextResponse("0|ParseError", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (fields.CheckMacValue && !verifyLogisticsCheckMacValue(fields)) {
    console.error("[logistics webhook] CheckMac mismatch");
    return new NextResponse("0|CheckMacValue Error", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const logisticsId = fields.AllPayLogisticsID || "";
  const tradeNo = fields.MerchantTradeNo || "";
  const statusCode = String(
    fields.RtnCode || fields.LogisticsStatus || "",
  ).trim();

  const order =
    (logisticsId ? await getShopOrderByLogisticsId(logisticsId) : null) ||
    (tradeNo ? await getShopOrderByTradeNo(tradeNo) : null);

  if (!order) {
    console.warn("[logistics webhook] order not found", {
      logisticsId,
      tradeNo,
      statusCode,
    });
    // 仍回 OK 避免綠界重試灌爆
    return new NextResponse("1|OK", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const now = new Date().toISOString();
  const mapped = resolveOrderPatchFromLogistics(statusCode, order.status);
  const patch: {
    logisticsStatus: string;
    logisticsId?: string;
    cvsPaymentNo?: string;
    cvsValidationNo?: string;
    status?: ShopOrderStatus;
    shippedAt?: string;
    completedAt?: string;
    paidAt?: string;
  } = {
    logisticsStatus: statusCode || order.logisticsStatus || "",
  };
  if (logisticsId && !order.logisticsId) patch.logisticsId = logisticsId;
  if (fields.CVSPaymentNo) patch.cvsPaymentNo = fields.CVSPaymentNo;
  if (fields.CVSValidationNo) patch.cvsValidationNo = fields.CVSValidationNo;

  if (mapped.status) patch.status = mapped.status;
  if (mapped.shippedAt) patch.shippedAt = order.shippedAt || now;
  if (mapped.completedAt) patch.completedAt = order.completedAt || now;
  if (mapped.paidAtIfCod && order.payment === "cod" && !order.paidAt) {
    patch.paidAt = now;
  }

  await patchShopOrder(order.storeSlug, order.id, patch);

  return new NextResponse("1|OK", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
