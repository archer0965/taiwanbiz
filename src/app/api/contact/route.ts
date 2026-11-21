import { sendContactNotifyEmail } from "@/lib/inquiry-mail";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

type Body = {
  storeName?: string;
  name?: string;
  phone?: string;
  message?: string;
  website?: string;
};

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`contact:${ip}`, 10, 60_000);
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

  if (body.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const storeName = (body.storeName?.trim() || "拓脈案例店家").slice(0, 80);
  const name = body.name?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  const phone = normalizeTaiwanMobile(body.phone ?? "");

  if (!name || name.length > 40) {
    return NextResponse.json({ error: "請填寫姓名" }, { status: 400 });
  }
  if (!isValidTaiwanMobile(phone)) {
    return NextResponse.json(
      { error: "請輸入正確的台灣手機號碼（09 開頭共 10 碼）" },
      { status: 400 },
    );
  }
  if (!message || message.length > 2000) {
    return NextResponse.json(
      { error: !message ? "請填寫留言內容" : "留言請控制在 2000 字以內" },
      { status: 400 },
    );
  }

  try {
    await sendContactNotifyEmail({ storeName, name, phone, message });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[contact]", error);
    return NextResponse.json(
      { error: "送出失敗，請稍後再試或改用電話／LINE 聯絡店家" },
      { status: 502 },
    );
  }
}
