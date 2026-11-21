import { sendInquiryEmail } from "@/lib/inquiry-mail";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";
import {
  interestedPlanOptions,
  STORE_TYPE_OPTIONS,
} from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

type Body = {
  name?: string;
  storeName?: string;
  storeType?: string;
  phone?: string;
  lineId?: string;
  plan?: string;
  need?: string;
  website?: string; // honeypot
};

const MAX = {
  name: 40,
  storeName: 80,
  lineId: 40,
  need: 2000,
  plan: 120,
  storeType: 40,
} as const;

const allowedStoreTypes = new Set<string>(STORE_TYPE_OPTIONS);
const allowedPlans = () => new Set(interestedPlanOptions());

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`inquiry:${ip}`, 6, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `送出太頻繁，請 ${limited.retryAfterSec} 秒後再試` },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  // 機器人 honeypot：有填寫就假裝成功
  if (body.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim() ?? "";
  const storeName = body.storeName?.trim() ?? "";
  const storeType = body.storeType?.trim() ?? "";
  const plan = body.plan?.trim() ?? "";
  const lineId = body.lineId?.trim() ?? "";
  const phone = normalizeTaiwanMobile(body.phone ?? "");
  const need =
    body.need?.trim() ||
    (plan ? `我想了解方案：${plan}` : "");

  if (!name || !storeName) {
    return NextResponse.json(
      { error: "請填寫聯絡人與店家名稱" },
      { status: 400 },
    );
  }
  if (
    name.length > MAX.name ||
    storeName.length > MAX.storeName ||
    storeType.length > MAX.storeType ||
    plan.length > MAX.plan
  ) {
    return NextResponse.json({ error: "欄位內容過長，請精簡後再送" }, { status: 400 });
  }
  if (!storeType || !allowedStoreTypes.has(storeType)) {
    return NextResponse.json({ error: "請選擇店面類型" }, { status: 400 });
  }
  if (!plan || !allowedPlans().has(plan)) {
    return NextResponse.json({ error: "請選擇感興趣的方案" }, { status: 400 });
  }
  if (!isValidTaiwanMobile(phone)) {
    return NextResponse.json(
      { error: "請輸入正確的台灣手機號碼（09 開頭共 10 碼）" },
      { status: 400 },
    );
  }
  if (!lineId || lineId.length < 2) {
    return NextResponse.json(
      { error: "請填寫 LINE ID，方便我們快速回覆" },
      { status: 400 },
    );
  }
  if (lineId.length > MAX.lineId) {
    return NextResponse.json({ error: "LINE ID 過長" }, { status: 400 });
  }
  if (!need) {
    return NextResponse.json({ error: "請簡單描述您的需求" }, { status: 400 });
  }
  if (need.length > MAX.need) {
    return NextResponse.json(
      { error: "需求說明請控制在 2000 字以內" },
      { status: 400 },
    );
  }

  try {
    const result = await sendInquiryEmail({
      name,
      storeName,
      storeType,
      phone,
      lineId,
      plan,
      need,
    });
    return NextResponse.json({ ok: true, provider: result.provider });
  } catch (error) {
    console.error("[inquiry]", error);
    const message = error instanceof Error ? error.message : "寄信失敗";
    const misconfigured = /尚未設定寄信憑證|GMAIL_APP_PASSWORD|RESEND_API_KEY/i.test(
      message,
    );
    return NextResponse.json(
      {
        error: misconfigured
          ? "諮詢通知信箱尚未完成設定，請稍後再試或直接以 LINE 聯絡我們"
          : "送出失敗，請稍後再試或直接以 LINE 聯絡我們",
      },
      { status: 502 },
    );
  }
}
