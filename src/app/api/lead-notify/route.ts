import { sendLeadNotifyEmail } from "@/lib/inquiry-mail";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

type Body = {
  storeName?: string;
  phone?: string;
  campaignName?: string;
  couponCode?: string;
  prize?: string;
};

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`lead:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "too many" }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const phone = normalizeTaiwanMobile(body.phone ?? "");
  const storeName = (body.storeName?.trim() || "拓脈案例店家").slice(0, 80);
  const campaignName = (body.campaignName?.trim() || "活動").slice(0, 80);
  const couponCode = (body.couponCode?.trim() || "").slice(0, 40);
  const prize = (body.prize?.trim() || "").slice(0, 120);

  if (!isValidTaiwanMobile(phone) || !couponCode) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    await sendLeadNotifyEmail({
      storeName,
      phone,
      campaignName,
      couponCode,
      prize,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[lead-notify]", error);
    // 發券流程不因通知失敗而阻斷顧客
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
