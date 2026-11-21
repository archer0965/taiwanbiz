/**
 * 專案架構限制（不可違反）
 *
 * 1. 純自助式 SaaS：禁止代管／託管（Managed Service）方案或流程
 * 2. 訂閱付費走綠界（信用卡／定期定額／ATM／超商）；免費用試用仍可先開通
 * 3. 方案僅雙卡：基礎版月 $299／年 $3,588；旗艦版月 $499／年 $5,988（主站權威）
 */

export const ARCHITECTURE = {
  selfServeOnly: true,
  billingMethod: "ecpay" as const,
  plans: {
    starter: { id: "starter", monthly: 299, annual: 2990 },
    flagship: { id: "growth", monthly: 499, annual: 4990 },
  },
} as const;

export const ECPAY_BILLING_MESSAGE =
  "本平台訂閱採綠界金流（信用卡／定期定額／ATM／超商代碼）。試用結束後請至後台完成線上付款開通。";

/** @deprecated 舊文案別名，導向綠界說明 */
export const BANK_TRANSFER_ONLY_MESSAGE = ECPAY_BILLING_MESSAGE;

export const SELF_SERVE_ONLY_MESSAGE =
  "本平台為純自助式 SaaS，不提供代管／託管（Managed Service）方案。";

/** 訂閱結帳允許的付款方式（綠界） */
export function assertSubscriptionEcpayPayment(
  paymentType: string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  const t = String(paymentType || "").toLowerCase();
  if (
    !t ||
    t === "period" ||
    t === "credit" ||
    t === "atm" ||
    t === "cvs" ||
    t === "onetime"
  ) {
    return { ok: true };
  }
  if (t === "bank_transfer") {
    return {
      ok: false,
      error: "訂閱已改為綠界線上付款，請改選信用卡／ATM／超商代碼。",
    };
  }
  return { ok: false, error: ECPAY_BILLING_MESSAGE };
}

/** @deprecated 使用 assertSubscriptionEcpayPayment */
export function assertSubscriptionBankTransfer(
  paymentType: string | null | undefined,
) {
  return assertSubscriptionEcpayPayment(paymentType);
}

/** 依方案 id 或月費推回標準牌價（月繳） */
export function canonicalMonthlyPrice(input: {
  planId?: string | null;
  planName?: string | null;
  monthlyHint?: number | null;
}): number {
  const id = (input.planId || "").toLowerCase();
  const name = input.planName || "";
  if (id === "starter" || name.includes("基礎")) {
    return ARCHITECTURE.plans.starter.monthly;
  }
  if (
    id === "growth" ||
    id === "flagship" ||
    name.includes("旗艦") ||
    name.includes("導流")
  ) {
    return ARCHITECTURE.plans.flagship.monthly;
  }
  const hint = Number(input.monthlyHint);
  if (hint === 299 || hint === 2990) return ARCHITECTURE.plans.starter.monthly;
  // 新牌價 + 舊牌價相容（599／5990 → 旗艦）
  if (
    hint === 499 ||
    hint === 4990 ||
    hint === 599 ||
    hint === 5990
  ) {
    return ARCHITECTURE.plans.flagship.monthly;
  }
  return ARCHITECTURE.plans.flagship.monthly;
}
