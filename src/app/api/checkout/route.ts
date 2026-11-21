import { getFoundingAvailability } from "@/lib/founding";
import {
  ownerHasPassword,
  setOwnerPassword,
} from "@/lib/owner-credentials-db.server";
import { validatePasswordStrength } from "@/lib/password";
import {
  normalizeSubscriptionPaymentType,
  type CheckoutPaymentType,
} from "@/lib/pricing";
import { normalizeReferralCode } from "@/lib/referral";
import { attachPendingReferral } from "@/lib/referral-db.server";
import {
  activateFoundingFreeSubscription,
  startFreeTrial,
  startSubscriptionCheckout,
} from "@/lib/subscription-billing";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import {
  toTenantDbRow,
  type TenantBillingMethod,
  type TenantPlanType,
} from "@/lib/tenants";
import { NextResponse } from "next/server";

export const instant = false;

type CheckoutBody = {
  planName?: string;
  amount?: number | string;
  storeId?: string;
  store_id?: string;
  isFoundingMember?: boolean;
  paymentType?: CheckoutPaymentType | "onetime";
  ownerEmail?: string;
  email?: string;
  name?: string;
  storeName?: string;
  planType?: TenantPlanType;
  plan_type?: TenantPlanType;
  renewalToken?: string;
  /** true：開通免費試用（不經綠界扣款） */
  startTrial?: boolean;
  /** true：前 15 組創始開通（14 天免費試用；之後續費 8 折） */
  activateFoundingFree?: boolean;
  /** 新帳號綁定登入密碼 */
  password?: string;
  confirmPassword?: string;
  /** 美業同業推薦碼（試用／開通時綁定，首次付費後獎勵生效） */
  referralCode?: string;
  /** 測試：模擬綠界付款成功 */
  simulateSuccess?: boolean;
};

async function bindOwnerPasswordIfNeeded(input: {
  email: string;
  password?: string;
  confirmPassword?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: true as const };
  if (await ownerHasPassword(email)) return { ok: true as const };
  const password = input.password || "";
  const confirmPassword = input.confirmPassword || "";
  const strength = validatePasswordStrength(password);
  if (strength) return { ok: false as const, error: strength };
  if (password !== confirmPassword) {
    return { ok: false as const, error: "兩次輸入的密碼不一致" };
  }
  const saved = await setOwnerPassword({
    email,
    password,
    force: true,
  });
  if (!saved.ok) return { ok: false as const, error: saved.error };
  return { ok: true as const };
}

function inferPlanType(
  _planName: string,
  _explicit?: TenantPlanType | string,
): TenantPlanType {
  void _planName;
  void _explicit;
  return "self-serve";
}

function slugifyStoreId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
    .replace(/[\u4e00-\u9fff]/g, (ch) => `u${ch.codePointAt(0)?.toString(16)}`)
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/**
 * 訂閱結帳入口：
 * - 免費試用／創始開通：不經綠界
 * - 正式付費：綠界（period／credit／atm／cvs）
 */
export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const planName = (body.planName || "").trim();
  const amountRaw = Number(body.amount);
  const storeIdRaw = (body.storeId || body.store_id || "").trim();
  const storeId = slugifyStoreId(storeIdRaw);
  const ownerEmail = (body.ownerEmail || body.email || "")
    .trim()
    .toLowerCase();
  const storeName = (body.name || body.storeName || planName || storeId).trim();
  const wantFounding = Boolean(body.isFoundingMember);
  const paymentType = normalizeSubscriptionPaymentType(body.paymentType);
  const wantTrial = Boolean(body.startTrial);

  if (!planName) {
    return NextResponse.json({ error: "缺少 planName" }, { status: 400 });
  }
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    return NextResponse.json({ error: "amount 必須為正數" }, { status: 400 });
  }
  if (!storeId || storeId.length < 2) {
    return NextResponse.json(
      { error: "缺少有效的 storeId（英數或可轉 slug）" },
      { status: 400 },
    );
  }
  if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: "Email 格式不正確" }, { status: 400 });
  }

  const founding = await getFoundingAvailability();
  const planType = inferPlanType(planName, body.planType || body.plan_type);
  const tenant = await getTenantDbByStoreId(storeId);

  const wantFoundingFree =
    Boolean(body.activateFoundingFree) ||
    (wantTrial && wantFounding && founding.available);

  // 前 15 組創始：占用名額＋14 天免費試用
  if (wantFoundingFree && wantFounding) {
    if (!ownerEmail) {
      return NextResponse.json(
        { error: "免付費開通需填寫負責人 Email" },
        { status: 400 },
      );
    }
    const alreadyFounding = Boolean(tenant?.isFoundingMember);
    if (!alreadyFounding && !founding.available) {
      return NextResponse.json(
        {
          error: "創始名額限量 10 組已額滿，無法申請",
          founding,
        },
        { status: 409 },
      );
    }
    const pwd = await bindOwnerPasswordIfNeeded({
      email: ownerEmail,
      password: body.password,
      confirmPassword: body.confirmPassword,
    });
    if (!pwd.ok) {
      return NextResponse.json({ error: pwd.error }, { status: 400 });
    }
    const free = await activateFoundingFreeSubscription({
      storeId,
      name: storeName,
      ownerEmail,
      planType,
      planName,
      listAmount: Math.round(amountRaw),
      billingMethod: "credit" as TenantBillingMethod,
    });
    if (!free.ok) {
      return NextResponse.json(
        { error: free.error, founding: free.founding },
        { status: free.error?.includes("額滿") ? 409 : 400 },
      );
    }

    const referralCode = normalizeReferralCode(String(body.referralCode || ""));
    let referralPending = false;
    if (referralCode) {
      const attached = await attachPendingReferral({
        codeRaw: referralCode,
        referredStoreId: storeId,
        referredEmail: ownerEmail,
        skipLastPaymentGate: true,
      });
      if (!attached.ok) {
        return NextResponse.json({ error: attached.error }, { status: 400 });
      }
      referralPending = true;
    }

    return NextResponse.json({
      ok: true,
      mode: "founding_free" as const,
      message: referralPending
        ? `${free.message}（已綁定推薦碼）`
        : free.message,
      storeId,
      planName,
      planType,
      isFoundingMember: true,
      listAmount: free.tenant.listAmount,
      amount: 0,
      payAmount: 0,
      referralPending,
      redirectUrl: free.redirectUrl,
      founding: free.founding,
      tenant: free.tenant,
      schema: toTenantDbRow(free.tenant),
    });
  }

  // 免費試用：新店或尚未用過試用／尚未付款（非創始）
  if (wantTrial) {
    if (!ownerEmail) {
      return NextResponse.json(
        { error: "開通試用需填寫負責人 Email" },
        { status: 400 },
      );
    }
    const pwd = await bindOwnerPasswordIfNeeded({
      email: ownerEmail,
      password: body.password,
      confirmPassword: body.confirmPassword,
    });
    if (!pwd.ok) {
      return NextResponse.json({ error: pwd.error }, { status: 400 });
    }
    const trial = await startFreeTrial({
      storeId,
      name: storeName,
      ownerEmail,
      planType,
      planName,
      listAmount: Math.round(amountRaw),
      isFoundingMember: false,
      billingMethod: "credit" as TenantBillingMethod,
    });
    if (!trial.ok) {
      return NextResponse.json({ error: trial.error }, { status: 400 });
    }

    const referralCode = normalizeReferralCode(String(body.referralCode || ""));
    let referralPending = false;
    if (referralCode) {
      const attached = await attachPendingReferral({
        codeRaw: referralCode,
        referredStoreId: storeId,
        referredEmail: ownerEmail,
      });
      if (!attached.ok) {
        return NextResponse.json({ error: attached.error }, { status: 400 });
      }
      referralPending = true;
    }

    const foundingAfter = await getFoundingAvailability();
    return NextResponse.json({
      ok: true,
      mode: "trial" as const,
      message: referralPending
        ? `${trial.message}（已綁定推薦碼；好友完成首次付費後獎勵才會生效）`
        : trial.message,
      storeId,
      planName,
      planType,
      isFoundingMember: trial.tenant.isFoundingMember,
      listAmount: trial.tenant.listAmount,
      amount: 0,
      trialEndsAt: trial.trialEndsAt,
      alreadyOnTrial: trial.alreadyOnTrial,
      referralPending,
      redirectUrl: trial.redirectUrl,
      founding: foundingAfter,
      tenant: trial.tenant,
      schema: toTenantDbRow(trial.tenant),
    });
  }

  // 正式付費：綠界
  if (!ownerEmail) {
    return NextResponse.json(
      { error: "正式訂閱需填寫負責人 Email" },
      { status: 400 },
    );
  }
  const pwd = await bindOwnerPasswordIfNeeded({
    email: ownerEmail,
    password: body.password,
    confirmPassword: body.confirmPassword,
  });
  if (!pwd.ok) {
    return NextResponse.json({ error: pwd.error }, { status: 400 });
  }

  const paid = await startSubscriptionCheckout({
    storeId,
    name: storeName,
    ownerEmail,
    planType,
    planName,
    listAmount: Math.round(amountRaw),
    paymentType,
    simulateSuccess: Boolean(body.simulateSuccess),
    finalAmount: Math.round(amountRaw),
  });
  if (!paid.ok) {
    return NextResponse.json({ error: paid.error }, { status: 400 });
  }

  const referralCode = normalizeReferralCode(String(body.referralCode || ""));
  if (referralCode) {
    const attached = await attachPendingReferral({
      codeRaw: referralCode,
      referredStoreId: storeId,
      referredEmail: ownerEmail,
      skipLastPaymentGate: paid.mode === "mock",
    });
    if (!attached.ok) {
      return NextResponse.json({ error: attached.error }, { status: 400 });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: paid.mode,
    message: paid.message,
    storeId,
    planName,
    planType,
    paymentType,
    isFoundingMember: paid.isFoundingMember,
    listAmount: paid.listAmount,
    amount: paid.amount,
    payAmount: paid.amount,
    orderId: paid.orderId,
    action: paid.action,
    params: paid.params,
    checkout: paid.checkout,
    redirectUrl: paid.redirectUrl,
    founding,
    tenant: paid.tenant,
    schema: paid.tenant ? toTenantDbRow(paid.tenant) : null,
  });
}
