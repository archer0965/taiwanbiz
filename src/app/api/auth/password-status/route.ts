import {
  isDemoOwnerEmail,
  isDeveloperEmail,
  isValidLoginEmail,
} from "@/lib/roles";
import { ownerHasPassword } from "@/lib/owner-credentials-db.server";
import { listTenantDb } from "@/lib/tenant-db.server";
import { NextResponse } from "next/server";

export const instant = false;

/**
 * 查詢店主 Email 是否可登入、是否已設定密碼
 * GET /api/auth/password-status?email=
 */
export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() || "";
  if (!email || !isValidLoginEmail(email)) {
    return NextResponse.json({ error: "Email 格式不正確" }, { status: 400 });
  }

  if (isDeveloperEmail(email)) {
    return NextResponse.json({
      ok: true,
      email,
      allowed: true,
      role: "admin",
      hasPassword: await ownerHasPassword(email),
      /** 總管可用 Google／示範登入，密碼為選用 */
      passwordRequired: false,
    });
  }

  const tenants = await listTenantDb();
  const provisioned = tenants.some(
    (t) => t.ownerEmail.trim().toLowerCase() === email,
  );
  const allowDemo =
    process.env.ALLOW_DEMO_LOGIN === "true" ||
    (process.env.VERCEL_ENV !== "production" &&
      process.env.ALLOW_DEMO_LOGIN !== "false");
  const demoOk =
    allowDemo && (isDemoOwnerEmail(email) || email.endsWith("@demo.tw"));
  const openOwner = process.env.ALLOW_OWNER_LOGIN === "true";
  const allowed = provisioned || demoOk || openOwner;
  const hasPassword = await ownerHasPassword(email);

  return NextResponse.json({
    ok: true,
    email,
    allowed,
    role: "owner",
    hasPassword,
    passwordRequired: true,
    needsSetup: allowed && !hasPassword,
  });
}
