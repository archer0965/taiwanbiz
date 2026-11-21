import { auth } from "@/auth";
import { isDeveloperEmail } from "@/lib/roles";
import { cancelSubscription } from "@/lib/subscription-billing";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { toTenantDbRow } from "@/lib/tenants";
import { NextResponse } from "next/server";

export const instant = false;

type Body = {
  storeId?: string;
  store_id?: string;
  reason?: string;
  /** true：立刻暫停店家；預設 false（當期結束後停用） */
  immediate?: boolean;
};

/**
 * 店主自助解約／停止定期付款
 * POST /api/billing/cancel
 */
export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!email) {
    return NextResponse.json({ error: "請先登入店主帳號" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storeId = (body.storeId || body.store_id || "").trim().toLowerCase();
  if (!storeId) {
    return NextResponse.json({ error: "缺少 storeId" }, { status: 400 });
  }

  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) {
    return NextResponse.json({ error: "找不到店家" }, { status: 404 });
  }

  const isOwner = tenant.ownerEmail.trim().toLowerCase() === email;
  if (!isOwner && !isDeveloperEmail(email)) {
    return NextResponse.json({ error: "無權限操作此店家" }, { status: 403 });
  }

  // 店主僅能申請「當期結束後停用」；立即停用保留給總管（或明確帶 immediate 的總管）
  const immediate = Boolean(body.immediate) && isDeveloperEmail(email);

  const result = await cancelSubscription({
    storeId,
    reason: body.reason,
    immediate,
    actorEmail: email,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    alreadyCancelled: result.alreadyCancelled,
    ecpay: result.ecpay,
    tenant: result.tenant,
    schema: result.tenant ? toTenantDbRow(result.tenant) : null,
  });
}
