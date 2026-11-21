import { auth } from "@/auth";
import {
  buildLogisticsPrintPayload,
  createCvsLogisticsOrder,
  ecpayMode,
} from "@/lib/ecpay";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";
import { isDeveloperEmail } from "@/lib/roles";
import {
  getShopOrder,
  patchShopOrder,
} from "@/lib/shop-orders-db.server";
import { getStoreContent } from "@/lib/store-content-db.server";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { NextResponse } from "next/server";

export const instant = false;

async function requireStoreAccess(storeSlug: string) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() || "";
  if (!email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const tenant = await getTenantDbByStoreId(storeSlug);
  if (!tenant) {
    return { error: NextResponse.json({ error: "找不到店家" }, { status: 404 }) };
  }
  const owner = tenant.ownerEmail.trim().toLowerCase() === email;
  if (!isDeveloperEmail(email) && !owner) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { email, tenant };
}

/**
 * POST action=create｜print
 * create：綠界建立超商物流單（貨到付款帶代收）
 * print：回傳列印託運單表單參數（前端開新視窗 POST）
 */
export async function POST(request: Request) {
  let body: {
    action?: "create" | "print";
    storeSlug?: string;
    orderId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storeSlug = (body.storeSlug || "").trim().toLowerCase();
  const orderId = (body.orderId || "").trim();
  const action = body.action || "create";
  if (!storeSlug || !orderId) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }

  const access = await requireStoreAccess(storeSlug);
  if ("error" in access && access.error) return access.error;

  const order = await getShopOrder(storeSlug, orderId);
  if (!order) {
    return NextResponse.json({ error: "找不到訂單" }, { status: 404 });
  }
  if (order.pickup !== "711" && order.pickup !== "family") {
    return NextResponse.json(
      { error: "僅超商取貨訂單可建立物流／列印託運單" },
      { status: 400 },
    );
  }
  if (["cancelled", "refunded"].includes(order.status)) {
    return NextResponse.json({ error: "此訂單已取消，無法出貨" }, { status: 400 });
  }
  if (action === "create") {
    const ready =
      order.payment === "cod"
        ? ["preparing", "shipped", "paid"].includes(order.status)
        : ["paid", "preparing", "shipped"].includes(order.status);
    if (!ready) {
      return NextResponse.json(
        {
          error:
            order.payment === "cod"
              ? "訂單狀態無法出貨"
              : "請等買家完成線上付款後再建立出貨單",
        },
        { status: 400 },
      );
    }
  }

  if (action === "print") {
    if (!order.logisticsId || !order.logisticsSubType) {
      return NextResponse.json(
        { error: "尚未建立物流單，請先按「建立出貨單」" },
        { status: 400 },
      );
    }
    const print = buildLogisticsPrintPayload({
      logisticsId: order.logisticsId,
      logisticsSubType: order.logisticsSubType,
      cvsPaymentNo: order.cvsPaymentNo,
      cvsValidationNo: order.cvsValidationNo,
    });
    return NextResponse.json({
      ok: true,
      mode: print.mode,
      action: print.action,
      params: print.params,
      message: "請列印託運單後貼上包裹，再送至超商寄件",
    });
  }

  // create
  if (order.logisticsId) {
    const print = buildLogisticsPrintPayload({
      logisticsId: order.logisticsId,
      logisticsSubType: order.logisticsSubType || "",
      cvsPaymentNo: order.cvsPaymentNo,
      cvsValidationNo: order.cvsValidationNo,
    });
    return NextResponse.json({
      ok: true,
      already: true,
      mode: ecpayMode(),
      order,
      print: {
        action: print.action,
        params: print.params,
      },
      message: "此訂單已建立物流單，可直接列印託運單",
    });
  }

  const storeCode = (order.storeCode || "").trim();
  if (!storeCode) {
    return NextResponse.json({ error: "訂單缺少取貨門市代號" }, { status: 400 });
  }
  // 常見測試假代號，綠界會回「門市不存在」
  if (/^(0{3,}|1{3,}|2{3,}|123456|654321|000000|111111|222222)$/.test(storeCode)) {
    return NextResponse.json(
      {
        error:
          "取貨門市代號無效（疑似測試門市）。請請買家用綠界電子地圖重選真實 7-11／全家門市後再建立出貨單。",
      },
      { status: 400 },
    );
  }

  const content = await getStoreContent(storeSlug);
  const senderPhone = normalizeTaiwanMobile(content?.profile?.phone || "");
  if (!isValidTaiwanMobile(senderPhone)) {
    return NextResponse.json(
      {
        error:
          "請先至「店家設定」填寫有效的寄件人手機（09 開頭 10 碼），才能建立綠界物流單",
      },
      { status: 400 },
    );
  }

  const senderName =
    content?.profile?.name ||
    content?.payout?.accountName ||
    storeSlug;
  const goodsName = order.lines
    .map((l) => `${l.name}x${l.quantity}`)
    .join(" ")
    .slice(0, 50);
  const logisticsTradeNo = `L${(order.tradeNo || order.id).replace(/[^A-Za-z0-9]/g, "")}`.slice(
    0,
    20,
  );

  // 7-11 C2C：代收金額須等於商品金額；買家付運費時一併計入
  const goodsAmount = Math.max(
    1,
    Math.round(
      order.totalAmount ??
        order.subtotal + Math.max(0, order.shippingFee || 0),
    ),
  );

  const created = await createCvsLogisticsOrder({
    merchantTradeNo: logisticsTradeNo,
    pickup: order.pickup,
    goodsAmount,
    goodsName: goodsName || `訂單${order.id}`,
    isCollection: order.payment === "cod",
    senderName,
    senderCellPhone: senderPhone,
    receiverName: order.customerName,
    receiverCellPhone: order.customerPhone,
    receiverEmail: order.customerEmail,
    receiverStoreId: order.storeCode!.trim(),
    remark: order.note,
  });

  if (!created.ok) {
    return NextResponse.json(
      { error: created.error, mode: created.mode, raw: created.raw },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  // 建立出貨單＝賣家已交寄流程開始；後續「到店／取件」由綠界物流 webhook 自動更新
  const updated = await patchShopOrder(storeSlug, orderId, {
    logisticsId: created.logisticsId,
    logisticsTradeNo: created.merchantTradeNo,
    logisticsSubType: created.logisticsSubType,
    cvsPaymentNo: created.cvsPaymentNo || null,
    cvsValidationNo: created.cvsValidationNo || null,
    logisticsStatus: created.rtnCode || "300",
    logisticsCreatedAt: now,
    status:
      order.status === "completed" || order.status === "cancelled"
        ? order.status
        : "shipped",
    shippedAt: order.shippedAt || now,
  });

  const print = buildLogisticsPrintPayload({
    logisticsId: created.logisticsId,
    logisticsSubType: created.logisticsSubType,
    cvsPaymentNo: created.cvsPaymentNo,
    cvsValidationNo: created.cvsValidationNo,
  });

  return NextResponse.json({
    ok: true,
    mode: created.mode,
    message:
      created.mode === "mock"
        ? "示範模式：已建立模擬物流單，可預覽託運單"
        : "物流單已建立，請列印託運單貼上後至超商寄件",
    order: updated,
    logistics: {
      logisticsId: created.logisticsId,
      logisticsSubType: created.logisticsSubType,
      cvsPaymentNo: created.cvsPaymentNo,
      cvsValidationNo: created.cvsValidationNo,
      rtnMsg: created.rtnMsg,
    },
    print,
  });
}
