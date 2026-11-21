import { validatePasswordStrength } from "@/lib/password";
import {
  isDemoOwnerEmail,
  isDeveloperEmail,
  isValidLoginEmail,
} from "@/lib/roles";
import {
  ownerHasPassword,
  setOwnerPassword,
} from "@/lib/owner-credentials-db.server";
import { listTenantDb } from "@/lib/tenant-db.server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export const instant = false;

type Body = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  currentPassword?: string;
};

async function canManagePassword(email: string) {
  if (isDeveloperEmail(email)) return true;
  const tenants = await listTenantDb();
  if (tenants.some((t) => t.ownerEmail.trim().toLowerCase() === email)) {
    return true;
  }
  const allowDemo =
    process.env.ALLOW_DEMO_LOGIN === "true" ||
    (process.env.VERCEL_ENV !== "production" &&
      process.env.ALLOW_DEMO_LOGIN !== "false");
  if (allowDemo && (isDemoOwnerEmail(email) || email.endsWith("@demo.tw"))) {
    return true;
  }
  return process.env.ALLOW_OWNER_LOGIN === "true";
}

/**
 * 首次綁定或變更店主密碼
 * POST /api/auth/set-password
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`set-password:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `操作太頻繁，請 ${limited.retryAfterSec} 秒後再試` },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const confirmPassword = body.confirmPassword || "";

  if (!email || !isValidLoginEmail(email)) {
    return NextResponse.json({ error: "Email 格式不正確" }, { status: 400 });
  }
  if (!(await canManagePassword(email))) {
    return NextResponse.json(
      { error: "此 Email 尚未綁定店家，無法設定密碼" },
      { status: 403 },
    );
  }

  const strength = validatePasswordStrength(password);
  if (strength) {
    return NextResponse.json({ error: strength }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "兩次輸入的密碼不一致" }, { status: 400 });
  }

  const hasPassword = await ownerHasPassword(email);
  const result = await setOwnerPassword({
    email,
    password,
    currentPassword: hasPassword ? body.currentPassword : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    message: result.created ? "密碼已設定，請以此登入" : "密碼已更新",
  });
}
