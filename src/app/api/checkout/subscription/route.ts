import { auth } from "@/auth";
import { isDeveloperEmail } from "@/lib/roles";
import { normalizeSubscriptionPaymentType } from "@/lib/pricing";
import type { CheckoutPaymentType } from "@/lib/pricing";
import { startSubscriptionCheckout } from "@/lib/subscription-billing";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { toTenantDbRow } from "@/lib/tenants";
import { NextResponse } from "next/server";

type Body = {
  storeId?: string;
  store_id?: string;
  simulateSuccess?: boolean;
  paymentType?: CheckoutPaymentType | "onetime";
  amount?: number;
};

/**
 * 總管訂閱操作：為指定店家建立綠界訂閱付款（或模擬成功）。
 */
export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!isDeveloperEmail(email)) {
    return NextResponse.json({ error: "需要總管理員權限" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storeId = (body.storeId || body.store_id || "").trim().toLowerCase();
  if (!storeId) {
    return NextResponse.json({ error: "缺少 store_id" }, { status: 400 });
  }

  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) {
    return NextResponse.json({ error: "找不到店家" }, { status: 404 });
  }

  const paymentType = normalizeSubscriptionPaymentType(body.paymentType);
  const paid = await startSubscriptionCheckout({
    storeId,
    name: tenant.name,
    ownerEmail: tenant.ownerEmail,
    planType: tenant.planType,
    planName: tenant.planName || undefined,
    listAmount: tenant.listAmount || undefined,
    paymentType,
    finalAmount:
      typeof body.amount === "number" && body.amount > 0
        ? Math.round(body.amount)
        : undefined,
    simulateSuccess: Boolean(body.simulateSuccess),
  });

  if (!paid.ok) {
    return NextResponse.json({ error: paid.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    mode: paid.mode,
    message: paid.message,
    storeId,
    paymentType,
    amount: paid.amount,
    orderId: paid.orderId,
    action: paid.action,
    params: paid.params,
    checkout: paid.checkout,
    redirectUrl: paid.redirectUrl,
    schema: paid.tenant ? toTenantDbRow(paid.tenant) : null,
    tenant: paid.tenant,
  });
}
