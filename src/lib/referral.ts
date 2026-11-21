/**
 * 美業同業推薦（Referral）— 防刷與限制
 * - 每位新賣家終身僅限使用 1 次推薦碼，且只能在首次訂閱付款時套用（首月現折 NT$50）
 * - 禁止使用自己的推薦碼
 * - 推薦人每成功推薦一位可累加 NT$100 扣抵；每期訂閱最多自動扣抵 NT$100
 */

export const REFERRAL_NEW_STORE_DISCOUNT = 50;
export const REFERRAL_REFERRER_CREDIT = 100;
/** 每期訂閱（月繳／年繳該次帳單）最多扣抵點數 */
export const REFERRAL_CREDIT_PER_CYCLE_CAP = 100;

export const REFERRAL_COPY = {
  title: "美業同業推薦",
  headline: "推薦同行開店，雙方都有獎勵",
  triggerNote:
    "獎勵將於被推薦好友完成首次付費對帳後自動發送至您的帳號中。",
  newStoreBenefit: `新店家使用推薦碼開通，首月訂閱現折 NT$ ${REFERRAL_NEW_STORE_DISCOUNT}（每位店家終身僅限 1 次）。`,
  referrerBenefit: `被推薦人完成首月對帳確認後，推薦人獲得扣抵點數 NT$ ${REFERRAL_REFERRER_CREDIT}（推薦次數無上限，點數可累加；每期訂閱最多扣抵 NT$ ${REFERRAL_CREDIT_PER_CYCLE_CAP}）。`,
  condition:
    "被推薦的新店家必須成功完成「首次付費訂閱／對帳確認」後，推薦獎勵方可生效。首次付款完成後不可再輸入推薦碼。",
  selfReferralError: "不可使用自己的推薦碼",
  oneTimeError: "每位店家終身僅限使用 1 次推薦碼",
  afterFirstPayError: "首次付款完成後不可再使用推薦碼",
} as const;

export type ReferralCreditStatus = "pending_first_payment" | "granted" | "applied";

export type ReferralRecord = {
  id: string;
  code: string;
  referrerStoreId: string;
  referrerEmail: string;
  referredStoreId: string;
  referredEmail: string;
  createdAt: string;
  /** 被推薦人首次付費完成時間；空＝尚未達觸發條件 */
  firstPaidAt: string | null;
  newStoreDiscount: number;
  referrerCredit: number;
  status: ReferralCreditStatus;
};

/** 正規化輸入：保留 REF- 前綴與連字號，其餘轉大寫 */
export function normalizeReferralCode(raw: string) {
  const upper = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return upper.slice(0, 24);
}

/** 比對用：去掉 REF-／REF 前綴與連字號後的本體 */
export function referralCodeBody(raw: string) {
  return normalizeReferralCode(raw)
    .replace(/^REF-?/, "")
    .replace(/-/g, "");
}

export function referralCodesEqual(a: string, b: string) {
  const left = referralCodeBody(a);
  const right = referralCodeBody(b);
  return Boolean(left) && left === right;
}

/**
 * 店家對外分享的專屬推薦碼（例：storeId `shop-123` → `REF-SHOP123`）
 */
export function referralCodeFromStoreId(storeId: string) {
  const compact = String(storeId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 16);
  if (!compact) return "";
  return `REF-${compact}`;
}

/**
 * 新店首月現折：僅在「尚未完成首次付費」時套用。
 * 推薦人的 NT$100 扣抵則等首月對帳通過後才入帳。
 */
export function applyReferralNewStoreDiscount(
  amount: number,
  hasValidReferralCode: boolean,
) {
  if (!hasValidReferralCode) return Math.max(0, Math.round(amount));
  return Math.max(0, Math.round(amount) - REFERRAL_NEW_STORE_DISCOUNT);
}

type ReferralTenantGate = {
  lastPaymentAt?: string | null;
  referralDiscountApplied?: number | null;
  referralCodeUsed?: string | null;
} | null | undefined;

/** 是否仍可在表單顯示／輸入推薦碼（首次付款前） */
export function canEnterReferralCode(tenant: ReferralTenantGate) {
  if (!tenant) return true;
  if (tenant.lastPaymentAt) return false;
  if ((Number(tenant.referralDiscountApplied) || 0) > 0) return false;
  return true;
}

/**
 * 是否仍可套用「被推薦人首月現折」。
 * 終身一次：已付過款或已套用過現折 → 不可。
 */
export function canApplyNewStoreReferralDiscount(tenant: ReferralTenantGate) {
  return canEnterReferralCode(tenant);
}

/**
 * 驗證「此店家是否還能使用／綁定推薦碼」。
 * - 首次付款後：一律拒絕
 * - 已綁定過不同碼：拒絕（終身 1 次）
 * - 已綁定相同碼：允許（重送匯款回報）
 */
export function validateReferralCodeForTenant(input: {
  codeRaw: string;
  storeId: string;
  ownerEmail?: string | null;
  tenant?: ReferralTenantGate;
  referrerStoreId?: string | null;
  referrerEmail?: string | null;
}): { ok: true; code: string } | { ok: false; error: string } {
  const code = normalizeReferralCode(input.codeRaw);
  if (!code) {
    return { ok: false, error: "請輸入有效推薦碼" };
  }

  const storeId = String(input.storeId || "")
    .trim()
    .toLowerCase();
  const ownCode = referralCodeFromStoreId(storeId);
  if (
    referralCodesEqual(code, storeId) ||
    referralCodesEqual(code, ownCode) ||
    (input.referrerStoreId &&
      input.referrerStoreId.trim().toLowerCase() === storeId)
  ) {
    return { ok: false, error: REFERRAL_COPY.selfReferralError };
  }

  const email = String(input.ownerEmail || "")
    .trim()
    .toLowerCase();
  const referrerEmail = String(input.referrerEmail || "")
    .trim()
    .toLowerCase();
  if (email && referrerEmail && email === referrerEmail) {
    return { ok: false, error: REFERRAL_COPY.selfReferralError };
  }

  const tenant = input.tenant;
  if (tenant?.lastPaymentAt) {
    return { ok: false, error: REFERRAL_COPY.afterFirstPayError };
  }
  if ((Number(tenant?.referralDiscountApplied) || 0) > 0) {
    return { ok: false, error: REFERRAL_COPY.oneTimeError };
  }
  if (
    tenant?.referralCodeUsed &&
    !referralCodesEqual(tenant.referralCodeUsed, code)
  ) {
    return { ok: false, error: REFERRAL_COPY.oneTimeError };
  }

  return { ok: true, code };
}

/**
 * 下期／本期帳單套用折抵餘額。
 * 點數可累加，但單次帳單最高扣抵 REFERRAL_CREDIT_PER_CYCLE_CAP（預設 NT$100）。
 */
export function applyBillingCredit(
  amount: number,
  creditBalance: number,
  options?: { maxPerCycle?: number },
) {
  const pay = Math.max(0, Math.round(amount));
  const credit = Math.max(0, Math.round(creditBalance));
  const cap = Math.max(
    0,
    Math.round(options?.maxPerCycle ?? REFERRAL_CREDIT_PER_CYCLE_CAP),
  );
  const usableThisCycle = Math.min(credit, cap);
  const used = Math.min(usableThisCycle, pay);
  return {
    payAmount: Math.max(0, pay - used),
    creditUsed: used,
    creditRemaining: credit - used,
    cycleCap: cap,
  };
}
