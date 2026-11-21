import { annualPrice } from "@/lib/pricing";
import { applyBillingCredit } from "@/lib/referral";
import { applyFoundingDiscount } from "@/lib/pricing";
import { startSubscriptionCheckout } from "@/lib/subscription-billing";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { resolveLifelongFounding } from "@/lib/founding";
import { ARCHITECTURE } from "@/lib/architecture-constraints";
import { normalizeSubscriptionPaymentType } from "@/lib/pricing";
import type { CheckoutPaymentType } from "@/lib/pricing";
import { NextResponse } from "next/server";

export const instant = false;

type Body = {
  storeId?: string;
  token?: string;
  mockCode?: boolean;
  paymentType?: CheckoutPaymentType | "onetime";
  /** starter | growth */
  planId?: string;
  billingCycle?: "monthly" | "annual";
  /** 覆蓋應付金額（已折抵） */
  amount?: number;
  simulateSuccess?: boolean;
};

/**
 * 公開續約：建立綠界訂閱付款（信用卡／定期定額／ATM／超商）。
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storeId = (body.storeId || "").trim().toLowerCase();
  if (!storeId) {
    return NextResponse.json({ error: "缺少 storeId" }, { status: 400 });
  }

  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) {
    return NextResponse.json({ error: "找不到店家" }, { status: 404 });
  }

  if (!body.mockCode) {
    const token = (body.token || "").trim();
    if (token && tenant.renewalToken && token !== tenant.renewalToken) {
      return NextResponse.json(
        { error: "續約連結無效或已過期，請向拓脈索取新連結" },
        { status: 403 },
      );
    }
  }

  const planId =
    body.planId === "starter"
      ? "starter"
      : body.planId === "growth"
        ? "growth"
        : (tenant.listAmount || 0) === ARCHITECTURE.plans.starter.monthly ||
            (tenant.listAmount || 0) === ARCHITECTURE.plans.starter.annual
          ? "starter"
          : "growth";
  const monthly =
    planId === "starter"
      ? ARCHITECTURE.plans.starter.monthly
      : ARCHITECTURE.plans.flagship.monthly;
  const cycle = body.billingCycle === "annual" ? "annual" : "monthly";
  const listAmount = cycle === "annual" ? annualPrice(monthly) : monthly;
  const isFoundingMember = resolveLifelongFounding(tenant);
  const afterFounding = applyFoundingDiscount(listAmount, isFoundingMember);
  const credited = applyBillingCredit(
    afterFounding,
    tenant.billingCreditBalance || 0,
  );
  const payAmount =
    typeof body.amount === "number" && body.amount > 0
      ? Math.max(1, Math.round(body.amount))
      : Math.max(1, credited.payAmount);

  const paymentType = normalizeSubscriptionPaymentType(body.paymentType);
  const planName = `${
    planId === "starter" ? "極速預約基礎版" : "品牌導流旗艦版"
  }${cycle === "annual" ? "（年繳）" : "（月繳）"}`;

  const paid = await startSubscriptionCheckout({
    storeId,
    name: tenant.name,
    ownerEmail: tenant.ownerEmail,
    planType: tenant.planType,
    planName,
    listAmount,
    paymentType,
    finalAmount: payAmount,
    simulateSuccess: Boolean(body.simulateSuccess || body.mockCode),
  });

  if (!paid.ok) {
    return NextResponse.json({ error: paid.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    mode: paid.mode,
    message: paid.message,
    storeId,
    billingMethod: paymentType,
    paymentType,
    amount: paid.amount,
    listAmount: paid.listAmount,
    orderId: paid.orderId,
    action: paid.action,
    params: paid.params,
    checkout: paid.checkout,
    redirectUrl:
      paid.redirectUrl ||
      `/welcome?storeId=${encodeURIComponent(storeId)}`,
  });
}
