import { verifyCheckMacValue } from "@/lib/ecpay";
import { applyFoundingDiscount } from "@/lib/pricing";
import {
  getShopOrderByTradeNo,
  patchShopOrder,
} from "@/lib/shop-orders-db.server";
import { sendRenewalPaymentCodeEmail } from "@/lib/subscription-mail";
import { getTenantDbByStoreId, patchTenantDb } from "@/lib/tenant-db.server";
import { planMonthlyAmount } from "@/lib/tenants";
import { NextResponse } from "next/server";

export const instant = false;

function parseForm(text: string) {
  const params = new URLSearchParams(text);
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

/**
 * 綠界 PaymentInfoURL：ATM／超商取號結果
 * 收到虛擬帳號或超商代碼後存檔並通知店家，供每月續約使用
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let payload: Record<string, string> = {};

  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(json)) {
        if (v !== undefined && v !== null) payload[k] = String(v);
      }
    } else {
      payload = parseForm(await request.text());
    }
  } catch {
    return new NextResponse("0|ParseError", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const isMock =
    payload.mock === "true" ||
    process.env.ECPAY_FORCE_MOCK === "true" ||
    !process.env.ECPAY_HASH_KEY?.trim();

  if (!isMock) {
    if (!payload.CheckMacValue || !verifyCheckMacValue(payload)) {
      return new NextResponse("0|CheckMacValueInvalid", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  const storeId = (payload.CustomField1 || "").trim().toLowerCase();
  if (!storeId) {
    return new NextResponse("0|MissingStoreId", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const bankCode = payload.BankCode || "";
  const vAccount = payload.vAccount || "";
  const paymentNo = payload.PaymentNo || "";
  const expireDate = payload.ExpireDate || "";

  let code = "";
  let label = "";
  if (vAccount) {
    code = bankCode ? `${bankCode}-${vAccount}` : vAccount;
    label = "ATM 虛擬帳號";
  } else if (paymentNo) {
    code = paymentNo;
    label = "超商繳費代碼";
  }

  if (!code) {
    return new NextResponse("0|NoPaymentCode", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const tradeNo = payload.MerchantTradeNo || "";
  const isShopOrder =
    payload.CustomField2 === "shop" || tradeNo.startsWith("PS");

  // 網拍顧客 ATM 取號
  if (isShopOrder) {
    const order =
      (await getShopOrderByTradeNo(tradeNo)) ||
      (payload.CustomField3
        ? await patchShopOrder(storeId, payload.CustomField3, {
            paymentCode: code,
            paymentExpireAt: expireDate || null,
            tradeNo: tradeNo || undefined,
          })
        : null);
    if (order && order.id) {
      await patchShopOrder(order.storeSlug || storeId, order.id, {
        paymentCode: code,
        paymentExpireAt: expireDate || null,
        tradeNo: tradeNo || order.tradeNo,
        status: "pending_payment",
      });
    }
    if (contentType.includes("application/json") && isMock) {
      return NextResponse.json({
        ok: true,
        kind: "shop",
        storeId,
        paymentCode: code,
        label,
        reply: "1|OK",
      });
    }
    return new NextResponse("1|OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) {
    return new NextResponse("0|StoreNotFound", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  await patchTenantDb(storeId, {
    status: "Pending",
    pendingPaymentCode: code,
    pendingPaymentLabel: label,
    pendingTradeNo: payload.MerchantTradeNo || tenant.pendingTradeNo,
    pendingPaymentExpireAt: expireDate || tenant.pendingPaymentExpireAt,
    billingMethod: vAccount ? "atm" : "cvs",
  });

  try {
    const listAmount =
      tenant.listAmount ?? planMonthlyAmount(tenant.planType);
    const payAmount = applyFoundingDiscount(
      listAmount,
      tenant.isFoundingMember,
    );
    await sendRenewalPaymentCodeEmail({
      storeName: tenant.name,
      ownerEmail: tenant.ownerEmail,
      storeId,
      paymentLabel: label,
      paymentCode: code,
      expireAt: expireDate || undefined,
      amount: payAmount,
      isFoundingMember: tenant.isFoundingMember,
    });
  } catch (error) {
    console.error("[payment-info] mail failed", error);
  }

  if (contentType.includes("application/json") && isMock) {
    return NextResponse.json({
      ok: true,
      storeId,
      paymentCode: code,
      label,
      reply: "1|OK",
    });
  }

  return new NextResponse("1|OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
