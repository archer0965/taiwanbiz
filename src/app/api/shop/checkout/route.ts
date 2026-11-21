import { buildShopOrderCheckoutPayload } from "@/lib/ecpay";
import {
  isShopPaymentEnabled,
  shopPaymentsUnavailableMessage,
} from "@/lib/ecpay-payments";
import { notifyShopSellerNewOrder } from "@/lib/notify-shop-seller";
import {
  createShopOrder,
  createShopTradeNo,
} from "@/lib/shop-orders-db.server";
import { applyShopPromo } from "@/lib/shop-promos";
import { resolveOrderShippingFee } from "@/lib/store-content";
import {
  getStoreContent,
  patchStoreContent,
} from "@/lib/store-content-db.server";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { NextResponse } from "next/server";

export const instant = false;

type LineInput = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  colorId?: string;
  colorName?: string;
};

type Body = {
  storeSlug?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  pickup?: "711" | "family" | "home";
  storeCode?: string;
  storeName?: string;
  address?: string;
  payment?: "credit" | "atm" | "cod";
  note?: string;
  promoCode?: string;
  lines?: LineInput[];
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storeSlug = (body.storeSlug || "").trim().toLowerCase();
  if (!storeSlug) {
    return NextResponse.json({ error: "缺少 storeSlug" }, { status: 400 });
  }

  const tenant = await getTenantDbByStoreId(storeSlug);
  if (!tenant) {
    return NextResponse.json({ error: "找不到店家" }, { status: 404 });
  }
  if (tenant.status === "Suspended") {
    return NextResponse.json({ error: "店家暫停接單中" }, { status: 403 });
  }

  const content = await getStoreContent(storeSlug);
  if (!content || content.mode !== "shop") {
    return NextResponse.json({ error: "此店家非網拍方案" }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return NextResponse.json({ error: "購物車是空的" }, { status: 400 });
  }

  const pickup = body.pickup || "711";
  if (pickup === "home") {
    return NextResponse.json(
      { error: "目前僅支援 7-11／全家超商取貨" },
      { status: 400 },
    );
  }
  const payment = "cod" as const;
  if (!isShopPaymentEnabled(payment)) {
    return NextResponse.json(
      { error: shopPaymentsUnavailableMessage() },
      { status: 400 },
    );
  }
  if (!(body.storeCode || "").trim()) {
    return NextResponse.json({ error: "請先選擇超商取貨門市" }, { status: 400 });
  }
  if (!(body.customerName || "").trim()) {
    return NextResponse.json({ error: "請填寫收件人姓名" }, { status: 400 });
  }
  if (!(body.customerPhone || "").trim()) {
    return NextResponse.json({ error: "請填寫手機號碼" }, { status: 400 });
  }

  const subtotal = lines.reduce(
    (sum, line) => sum + Math.round(line.price) * Math.max(1, line.quantity),
    0,
  );

  const codeInput = (body.promoCode || "").trim();
  const applied = applyShopPromo(content.shopPromos || [], subtotal, codeInput);
  if (codeInput && !applied) {
    return NextResponse.json(
      { error: "優惠碼無效、未達門檻或已過期／額滿" },
      { status: 400 },
    );
  }

  const resolvedShipping = resolveOrderShippingFee(pickup, content.shipping);
  const shippingPayer = resolvedShipping.shippingPayer;
  let shippingFee = resolvedShipping.shippingFee;
  if (applied?.freeShipping) {
    shippingFee = 0;
  }

  const orderId = `ORD${Date.now().toString(36).toUpperCase()}`.slice(0, 16);
  const tradeNo = createShopTradeNo(storeSlug);
  const itemName = lines
    .map((l) => `${l.name} x${l.quantity}`)
    .join("#")
    .slice(0, 200);

  const baseOrder = {
    id: orderId,
    storeSlug,
    customerName: (body.customerName || "").trim(),
    customerPhone: (body.customerPhone || "").trim(),
    customerEmail: (body.customerEmail || "").trim() || undefined,
    pickup,
    storeCode: body.storeCode?.trim(),
    storeName: body.storeName?.trim(),
    address: body.address?.trim(),
    note: body.note?.trim(),
    lines,
    subtotal,
    discountAmount: applied?.discountAmount || 0,
    promoId: applied?.promoId || null,
    promoCode: applied?.promoCode || null,
    promoName: applied?.promoName || null,
    shippingFee,
    shippingPayer,
    tradeNo,
  };

  const currentPromos = content.shopPromos || [];
  async function bumpPromoUsage() {
    if (!applied) return;
    const nextPromos = currentPromos.map((p) =>
      p.id === applied.promoId
        ? { ...p, usedCount: (p.usedCount || 0) + 1 }
        : p,
    );
    await patchStoreContent(storeSlug, { shopPromos: nextPromos });
  }

  // 貨到付款：不導向綠界線上金流，訂單直接進入備貨
  if (payment === "cod") {
    const order = await createShopOrder({
      ...baseOrder,
      payment: "cod",
      status: "preparing",
    });
    await bumpPromoUsage();
    await notifyShopSellerNewOrder(order);

    const bits = ["訂單已成立：超商取貨時付款（貨到付款）"];
    if ((applied?.discountAmount || 0) > 0) {
      bits.push(`已套用優惠「${applied!.promoName}」折抵 NT$${applied!.discountAmount}`);
    }
    if (applied?.freeShipping) bits.push("享免運");
    else if (shippingFee > 0) bits.push(`含運費 NT$${shippingFee}`);

    return NextResponse.json({
      ok: true,
      mode: "cod" as const,
      message: `${bits.join("。")}。賣家出貨後請至門市取貨並完成付款。`,
      order,
      redirectUrl: `/stores/${encodeURIComponent(storeSlug)}?order=${encodeURIComponent(order.id)}&cod=1`,
    });
  }

  const order = await createShopOrder({
    ...baseOrder,
    payment,
  });
  await bumpPromoUsage();

  const payAmount = order.totalAmount ?? Math.max(1, subtotal - (applied?.discountAmount || 0) + shippingFee);
  if (payAmount < 1) {
    return NextResponse.json(
      { error: "折抵後應付金額過低，請調整優惠或商品" },
      { status: 400 },
    );
  }

  const checkout = buildShopOrderCheckoutPayload({
    storeSlug,
    orderId: order.id,
    tradeNo,
    amount: payAmount,
    itemName: itemName || `Pulse Shop ${storeSlug}`,
    payment,
    customerEmail: body.customerEmail,
  });

  if (checkout.mode === "mock") {
    return NextResponse.json({
      ok: true,
      mode: "mock" as const,
      message: "示範模式：已建立訂單（正式環境將導向綠界付款）",
      order,
      checkout,
      redirectUrl: `/stores/${encodeURIComponent(storeSlug)}?order=${encodeURIComponent(order.id)}&mock=1`,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "live" as const,
    message: "請導向綠界完成付款",
    order,
    action: checkout.action,
    params: checkout.params,
    checkout,
  });
}
