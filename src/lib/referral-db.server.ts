import {
  REFERRAL_COPY,
  REFERRAL_CREDIT_PER_CYCLE_CAP,
  REFERRAL_NEW_STORE_DISCOUNT,
  REFERRAL_REFERRER_CREDIT,
  applyBillingCredit,
  normalizeReferralCode,
  referralCodeFromStoreId,
  referralCodesEqual,
  validateReferralCodeForTenant,
  type ReferralRecord,
} from "@/lib/referral";
import { pushSellerNotification } from "@/lib/seller-notifications-db.server";
import {
  getTenantDbByStoreId,
  listTenantDb,
  patchTenantDb,
} from "@/lib/tenant-db.server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "taiwanbiz-referrals")
    : path.join(process.cwd(), ".data", "referrals");
const DATA_FILE = path.join(DATA_DIR, "all.json");

const g = globalThis as typeof globalThis & {
  __taiwanbizReferrals?: ReferralRecord[];
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): ReferralRecord[] {
  if (g.__taiwanbizReferrals) return g.__taiwanbizReferrals;
  try {
    ensureDir();
    if (!existsSync(DATA_FILE)) {
      g.__taiwanbizReferrals = [];
      return g.__taiwanbizReferrals;
    }
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as ReferralRecord[];
    g.__taiwanbizReferrals = Array.isArray(raw) ? raw : [];
  } catch {
    g.__taiwanbizReferrals = [];
  }
  return g.__taiwanbizReferrals;
}

function writeAll(list: ReferralRecord[]) {
  ensureDir();
  const trimmed = list.slice(0, 2000);
  g.__taiwanbizReferrals = trimmed;
  writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

export function createReferralId() {
  return `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function findReferrerByCode(codeRaw: string) {
  const code = normalizeReferralCode(codeRaw);
  if (!code) return null;
  const tenants = await listTenantDb();
  return (
    tenants.find((t) => {
      const own = referralCodeFromStoreId(t.storeId);
      return (
        referralCodesEqual(own, code) ||
        referralCodesEqual(t.slug, code) ||
        referralCodesEqual(t.storeId, code)
      );
    }) || null
  );
}

export function saveReferralRecord(record: ReferralRecord) {
  const list = readAll();
  list.unshift(record);
  writeAll(list);
  return record;
}

export function listReferralsForStore(storeId: string) {
  const id = storeId.trim().toLowerCase();
  return readAll().filter(
    (r) => r.referrerStoreId === id || r.referredStoreId === id,
  );
}

export function getPendingReferralForReferred(storeId: string) {
  const id = storeId.trim().toLowerCase();
  return (
    readAll().find(
      (r) =>
        r.referredStoreId === id && r.status === "pending_first_payment",
    ) || null
  );
}

export function getAnyReferralForReferred(storeId: string) {
  const id = storeId.trim().toLowerCase();
  return readAll().find((r) => r.referredStoreId === id) || null;
}

/**
 * 試用／匯款回報時建立 pending；首次付費審核通過前不發推薦人折抵。
 * 終身僅限 1 次；不可自推。
 * @param skipLastPaymentGate 創始免付費開通後同請求綁定用（開通會寫入 lastPaymentAt）
 */
export async function attachPendingReferral(input: {
  codeRaw: string;
  referredStoreId: string;
  referredEmail: string;
  skipLastPaymentGate?: boolean;
}) {
  const code = normalizeReferralCode(input.codeRaw);
  if (!code) {
    return { ok: false as const, error: "請輸入有效推薦碼" };
  }

  const referredId = input.referredStoreId.trim().toLowerCase();
  const referredEmail = input.referredEmail.trim().toLowerCase();
  const tenant = await getTenantDbByStoreId(referredId);
  const referrer = await findReferrerByCode(code);
  if (!referrer) {
    return { ok: false as const, error: "找不到此推薦碼對應的店家" };
  }

  const tenantForGate =
    input.skipLastPaymentGate && tenant
      ? { ...tenant, lastPaymentAt: null }
      : tenant;

  const gate = validateReferralCodeForTenant({
    codeRaw: code,
    storeId: referredId,
    ownerEmail: referredEmail || tenant?.ownerEmail,
    tenant: tenantForGate,
    referrerStoreId: referrer.storeId,
    referrerEmail: referrer.ownerEmail,
  });
  if (!gate.ok) {
    return { ok: false as const, error: gate.error };
  }

  const alreadyGranted = readAll().find(
    (r) =>
      r.referredStoreId === referredId &&
      (r.status === "granted" || r.status === "applied"),
  );
  if (alreadyGranted) {
    return { ok: false as const, error: REFERRAL_COPY.oneTimeError };
  }

  const existing = getPendingReferralForReferred(referredId);
  if (existing) {
    if (!referralCodesEqual(existing.code, code)) {
      return { ok: false as const, error: REFERRAL_COPY.oneTimeError };
    }
    return { ok: true as const, referral: existing, referrer, reused: true };
  }

  const canonicalCode = referralCodeFromStoreId(referrer.storeId) || code;
  const referral: ReferralRecord = {
    id: createReferralId(),
    code: canonicalCode,
    referrerStoreId: referrer.storeId,
    referrerEmail: referrer.ownerEmail,
    referredStoreId: referredId,
    referredEmail,
    createdAt: new Date().toISOString(),
    firstPaidAt: null,
    newStoreDiscount: REFERRAL_NEW_STORE_DISCOUNT,
    referrerCredit: REFERRAL_REFERRER_CREDIT,
    status: "pending_first_payment",
  };
  saveReferralRecord(referral);

  await patchTenantDb(referredId, {
    referralCodeUsed: canonicalCode,
  });

  return { ok: true as const, referral, referrer, reused: false };
}

/**
 * 被推薦人首次付費成功（管理員對帳通過）：
 * - 標記推薦紀錄 granted
 * - 推薦人 billingCreditBalance += 100（可累加，推薦次數無上限）
 * - 被推薦人標記首月折抵已生效（終身鎖定）
 */
export async function grantReferralOnFirstPayment(referredStoreId: string) {
  const pending = getPendingReferralForReferred(referredStoreId);
  if (!pending) {
    return { ok: false as const, reason: "no_pending_referral" as const };
  }

  const list = readAll();
  const hit = list.find((r) => r.id === pending.id);
  if (!hit || hit.status !== "pending_first_payment") {
    return { ok: false as const, reason: "already_granted" as const };
  }

  hit.firstPaidAt = new Date().toISOString();
  hit.status = "granted";
  writeAll(list);

  const current = await getTenantDbByStoreId(hit.referrerStoreId);
  const nextCredit =
    (Number(current?.billingCreditBalance) || 0) + REFERRAL_REFERRER_CREDIT;
  const updatedReferrer = await patchTenantDb(hit.referrerStoreId, {
    billingCreditBalance: nextCredit,
  });

  await patchTenantDb(referredStoreId, {
    referralCodeUsed: hit.code,
    referralDiscountApplied: REFERRAL_NEW_STORE_DISCOUNT,
  });

  try {
    pushSellerNotification({
      storeId: hit.referrerStoreId,
      ownerEmail: hit.referrerEmail,
      kind: "system",
      title: "同業推薦獎勵已入帳",
      body: `被推薦店家完成首月對帳確認，您已獲得扣抵點數 NT$ ${REFERRAL_REFERRER_CREDIT}（目前餘額 NT$ ${nextCredit}；每期訂閱最多扣抵 NT$ ${REFERRAL_CREDIT_PER_CYCLE_CAP}）。`,
      href: "/dashboard/billing",
    });
  } catch (error) {
    console.error("[referral-credit-notify]", error);
  }

  return {
    ok: true as const,
    referral: hit,
    referrer: updatedReferrer,
    newStoreDiscount: REFERRAL_NEW_STORE_DISCOUNT,
    referrerCredit: REFERRAL_REFERRER_CREDIT,
    creditBalance: nextCredit,
  };
}

/** 續約時消耗折抵餘額（每期上限 REFERRAL_CREDIT_PER_CYCLE_CAP） */
export async function consumeBillingCredit(
  storeId: string,
  amountBeforeCredit: number,
) {
  const tenant = await getTenantDbByStoreId(storeId);
  const balance = Number(tenant?.billingCreditBalance) || 0;
  const credited = applyBillingCredit(amountBeforeCredit, balance);
  if (credited.creditUsed <= 0) {
    return credited;
  }
  await patchTenantDb(storeId, {
    billingCreditBalance: credited.creditRemaining,
  });
  return credited;
}
