import { verifyCheckMacValue } from "@/lib/ecpay";
import { handlePaymentWebhook } from "@/lib/subscription-billing";
import { toTenantDbRow } from "@/lib/tenants";
import { NextResponse } from "next/server";

type JsonBody = {
  storeId?: string;
  store_id?: string;
  CustomField1?: string;
  result?: "success" | "failed";
  RtnCode?: string | number;
  MerchantMemberID?: string;
  merchant_member_id?: string;
  MerchantTradeNo?: string;
  CheckMacValue?: string;
  /** 示範用：略過 CheckMacValue */
  mock?: boolean;
};

function parseForm(text: string) {
  const params = new URLSearchParams(text);
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

/**
 * 綠界定期扣款結果 Webhook
 * - 成功：Active + next_billing_date +30 天
 * - 失敗：Pending + grace_period_ends_at（預設 3 天）+ 催繳 Email
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let payload: JsonBody & Record<string, string> = {};

  try {
    if (contentType.includes("application/json")) {
      payload = (await request.json()) as JsonBody & Record<string, string>;
    } else {
      const text = await request.text();
      payload = parseForm(text) as JsonBody & Record<string, string>;
    }
  } catch {
    return NextResponse.json({ error: "無法解析 Webhook 內容" }, { status: 400 });
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
    return NextResponse.json({ error: "缺少 store_id" }, { status: 400 });
  }

  const isMock =
    payload.mock === true ||
    process.env.ECPAY_FORCE_MOCK === "true" ||
    !process.env.ECPAY_HASH_KEY;

  if (!isMock && payload.CheckMacValue) {
    const valid = verifyCheckMacValue(payload);
    if (!valid) {
      return NextResponse.json({ error: "CheckMacValue 驗證失敗" }, { status: 401 });
    }
  }

  const rtn = String(payload.RtnCode ?? "");
  const result: "success" | "failed" =
    payload.result === "success" ||
    payload.result === "failed"
      ? payload.result
      : rtn === "1" || rtn.toLowerCase() === "success"
        ? "success"
        : "failed";

  const handled = await handlePaymentWebhook({
    storeId,
    result,
    merchantMemberId:
      payload.MerchantMemberID || payload.merchant_member_id || undefined,
    tradeNo: payload.MerchantTradeNo,
  });

  if (!handled.ok) {
    return NextResponse.json({ error: handled.error }, { status: 404 });
  }

  // 綠界部分回調期待純文字 1|OK
  if (!contentType.includes("application/json") && !payload.mock) {
    return new NextResponse("1|OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({
    ok: true,
    result: handled.result,
    message: handled.message,
    schema: handled.tenant ? toTenantDbRow(handled.tenant) : null,
    tenant: handled.tenant,
    mail: "mail" in handled ? handled.mail : undefined,
  });
}
