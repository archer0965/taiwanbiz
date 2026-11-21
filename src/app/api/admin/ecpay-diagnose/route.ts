import { auth } from "@/auth";
import {
  buildCheckMacValue,
  buildDynamicCheckoutPayload,
  ecpayConfigured,
  ecpayMode,
  merchantId,
} from "@/lib/ecpay";
import { isDeveloperEmail } from "@/lib/roles";
import { NextResponse } from "next/server";

export const instant = false;

/**
 * 總管：綠界憑證／CheckMac 健檢（不回傳完整金鑰）。
 * POST 會對 payment.ecpay.com.tw 送一筆探針訂單並回報綠界錯誤碼。
 */
export async function GET() {
  const session = await auth();
  if (!isDeveloperEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = process.env.ECPAY_HASH_KEY?.trim() || "";
  const iv = process.env.ECPAY_HASH_IV?.trim() || "";
  const sample = {
    MerchantID: merchantId(),
    MerchantTradeNo: "DIAG" + Date.now().toString().slice(-12),
    MerchantTradeDate: "2026/01/01 12:00:00",
    PaymentType: "aio",
    TotalAmount: "100",
    TradeDesc: "diagnose",
    ItemName: "diagnose item",
    ReturnURL: "https://taiwanbiz.vercel.app/api/webhooks/ecpay",
    ChoosePayment: "Credit",
    EncryptType: "1",
  };
  const mac = buildCheckMacValue(sample);

  return NextResponse.json({
    ok: true,
    configured: ecpayConfigured(),
    mode: ecpayMode(),
    merchantId: merchantId(),
    hashKeyLen: key.length,
    hashKeyHead: key.slice(0, 2),
    hashKeyTail: key.slice(-2),
    hashIvLen: iv.length,
    hashIvHead: iv.slice(0, 2),
    hashIvTail: iv.slice(-2),
    forceMock: process.env.ECPAY_FORCE_MOCK || "",
    stage: process.env.ECPAY_STAGE || "",
    sampleCheckMacLen: mac.length,
    hint:
      "若 probe 回 10200074：商店代號與 Hash 不成對，或正式金流尚未開通。請到綠界廠商專區確認。",
  });
}

export async function POST() {
  const session = await auth();
  if (!isDeveloperEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = buildDynamicCheckoutPayload({
    storeId: "diag",
    planName: "診斷探針",
    amount: 299,
    isFoundingMember: false,
    paymentType: "credit",
    orderId: `DG${Date.now().toString().slice(-14)}`.slice(0, 20),
  });

  const action =
    process.env.ECPAY_STAGE === "true"
      ? "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"
      : payload.action;

  try {
    const res = await fetch(action, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams(payload.params).toString(),
      redirect: "manual",
    });
    const text = await res.text();
    const code = (text.match(/1020\d{4}/) || [])[0] || null;
    const msg =
      (text.match(/訊息說明[：:]\s*([^<\n]+)/) || [])[1]?.trim() || null;
    const looksLikePayPage =
      /付款方式|信用卡|交易金額/.test(text) && !/交易失敗/.test(text);

    return NextResponse.json({
      ok: looksLikePayPage,
      mode: payload.mode,
      merchantId: payload.params.MerchantID,
      action,
      httpStatus: res.status,
      ecpayCode: code,
      ecpayMessage: msg,
      failEncryptionKey: code === "10200074",
      diagnosis:
        code === "10200074"
          ? "綠界找不到此 MerchantID 對應的加密金鑰，或該付款方式未開通。請核對廠商專區「系統介接設定」的商店代號是否與 ECPAY_MERCHANT_ID 完全一致，並確認驗證／服務已開通金流收款。"
          : looksLikePayPage
            ? "探針成功：綠界已接受參數並進入付款頁。"
            : "綠界未進入付款頁，請查看 ecpayCode／ecpayMessage。",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "probe failed",
      },
      { status: 500 },
    );
  }
}
