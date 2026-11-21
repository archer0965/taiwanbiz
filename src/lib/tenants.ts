/** 平台僅自主預約（self-serve）；歷史其他 plan_type 讀入時一律正規化 */
export type TenantPlanType = "self-serve";
export type TenantStatus = "Active" | "Pending" | "Suspended";

/** 將歷史／未知 plan_type 正規化為 self-serve */
export function normalizePlanType(raw: unknown): TenantPlanType {
  void raw;
  return "self-serve";
}
/** subscriptions.status：對外／報表用生命週期（對應 active / expired / trial） */
export type SubscriptionLifecycleStatus = "active" | "expired" | "trial";
export type TenantBillingMethod =
  | "period"
  | "credit"
  | "atm"
  | "cvs"
  | "bank_transfer";

/**
 * Tenants / 訂閱 Schema
 * API 層亦對應 snake_case：store_id、plan_type、next_billing_date、
 * grace_period_ends_at、merchant_member_id、expires_at
 * subscriptions 視圖：expires_at + status(active|expired|trial)
 */
export type TenantRecord = {
  id: string;
  /** 等同 store_id，預設與 slug 一致 */
  storeId: string;
  name: string;
  slug: string;
  planType: TenantPlanType;
  status: TenantStatus;
  /** YYYY-MM-DD 顯示用到期日（與 nextBillingDate 對齊）＝ subscriptions.expires_at */
  expiresAt: string;
  /** 下次自動扣款日 ISO / YYYY-MM-DD */
  nextBillingDate: string | null;
  /** 寬限期結束時間 ISO；逾期未繳將被 Cron 暫停 */
  gracePeriodEndsAt: string | null;
  /** 綠界定期定額／信用卡授權會員編號 */
  merchantMemberId: string | null;
  /** 首次付款後保存的授權 Token（示範環境為模擬值） */
  cardToken: string | null;
  lastPaymentAt: string | null;
  pageViews: number;
  ownerEmail: string;
  createdAt: string;
  /** 是否占用創始會員名額（前 15 組：14 天試用＋續費終身 8 折） */
  isFoundingMember: boolean;
  /** 慣用續約金流 */
  billingMethod: TenantBillingMethod;
  /** 方案顯示名稱（續約產碼用） */
  planName: string | null;
  /** 原價月費（折扣前） */
  listAmount: number | null;
  /** 待繳：ATM 帳號／超商繳費代碼 */
  pendingPaymentCode: string | null;
  /** 待繳類型說明（ATM／CVS） */
  pendingPaymentLabel: string | null;
  /** 待繳綠界訂單編號 */
  pendingTradeNo: string | null;
  /** 待繳代碼到期 */
  pendingPaymentExpireAt: string | null;
  /** 續約連結驗證用 token */
  renewalToken: string | null;
  /**
   * 綠界定期定額原始 MerchantTradeNo（取消續扣用）
   * 與 pendingTradeNo 不同：付款成功後仍需保留
   */
  periodTradeNo: string | null;
  /** 已申請解約時間 ISO；當期結束後由 cron 暫停 */
  cancelledAt: string | null;
  /** 解約原因／備註 */
  cancelReason: string | null;
  /** 免費試用開始時間 ISO */
  trialStartedAt: string | null;
  /** 免費試用結束時間 ISO；尚無 lastPaymentAt 且未逾此時點＝試用中 */
  trialEndsAt: string | null;
  /** 下期帳單折抵餘額（推薦獎勵等） */
  billingCreditBalance: number;
  /** 開通時使用的同業推薦碼 */
  referralCodeUsed: string | null;
  /** 首月已套用的推薦現折金額 */
  referralDiscountApplied: number;
  /**
   * 到期前 3 天提醒已發送時，記錄當時對應的到期日（YYYY-MM-DD）
   * 用於 Cron 去重，避免每日重複推播
   */
  expiryReminderForExpiresAt: string | null;
  /**
   * 到期前 1 天提醒已發送時，記錄當時對應的到期日（YYYY-MM-DD）
   */
  expiryReminderD1ForExpiresAt: string | null;
  /** 最近一次到期提醒發送時間 ISO */
  expiryReminderSentAt: string | null;
};

export type TenantDbRow = {
  store_id: string;
  plan_type: TenantPlanType;
  status: TenantStatus;
  next_billing_date: string | null;
  grace_period_ends_at: string | null;
  merchant_member_id: string | null;
  /** subscriptions.expires_at */
  expires_at: string;
  /** subscriptions.status：active / expired / trial */
  subscription_status: SubscriptionLifecycleStatus;
};

/** 對應 subscriptions 表格列 */
export type SubscriptionRow = {
  store_id: string;
  expires_at: string;
  status: SubscriptionLifecycleStatus;
  operational_status: TenantStatus;
  next_billing_date: string | null;
  trial_ends_at: string | null;
};

export const PLAN_TYPE_LABELS: Record<TenantPlanType, string> = {
  "self-serve": "自主預約",
};

export const STATUS_LABELS: Record<TenantStatus, string> = {
  Active: "已開通",
  Pending: "審核中",
  Suspended: "已暫停",
};

/** 賣家後台顯示用訂閱狀態文案 */
export function formatSellerSubscriptionStatus(
  tenant: TenantRecord,
  now = new Date(),
) {
  if (isTenantOnTrial(tenant, now)) {
    return `試用中${
      tenant.trialEndsAt ? `（至 ${tenant.trialEndsAt.slice(0, 10)}）` : ""
    }`;
  }
  if (tenant.status === "Pending") {
    return "審核中";
  }
  if (isTenantBookingSuspended(tenant, now) || tenant.status === "Suspended") {
    return `已到期暫停${tenant.expiresAt ? `（到期日: ${tenant.expiresAt}）` : ""}`;
  }
  if (tenant.status === "Active") {
    return `已開通 (到期日: ${tenant.expiresAt || "—"})`;
  }
  return STATUS_LABELS[tenant.status];
}

/** 忘記續費後保留網站的天數（寬限結束才 Suspended） */
export const GRACE_PERIOD_DAYS = Number(
  process.env.SUBSCRIPTION_GRACE_DAYS || 30,
);

function addDaysIso(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function addDaysDateOnly(base: Date, days: number) {
  return addDaysIso(base, days).slice(0, 10);
}

export function normalizeTenant(
  raw: Partial<TenantRecord> & {
    id?: string;
    slug: string;
    name: string;
    planType: TenantPlanType;
  },
): TenantRecord {
  const slug = raw.slug;
  const nextBilling =
    raw.nextBillingDate ??
    (raw.expiresAt ? `${raw.expiresAt}T00:00:00.000Z` : null);
  return {
    id: raw.id ?? `t-${slug}`,
    storeId: raw.storeId ?? slug,
    name: raw.name,
    slug,
    planType: normalizePlanType(raw.planType),
    status: raw.status ?? "Pending",
    expiresAt: raw.expiresAt ?? (nextBilling ? nextBilling.slice(0, 10) : ""),
    nextBillingDate: nextBilling,
    gracePeriodEndsAt: raw.gracePeriodEndsAt ?? null,
    merchantMemberId: raw.merchantMemberId ?? null,
    cardToken: raw.cardToken ?? null,
    lastPaymentAt: raw.lastPaymentAt ?? null,
    pageViews: raw.pageViews ?? 0,
    ownerEmail: raw.ownerEmail ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    isFoundingMember: Boolean(raw.isFoundingMember),
    billingMethod: raw.billingMethod ?? "credit",
    planName: raw.planName ?? null,
    listAmount:
      typeof raw.listAmount === "number" && Number.isFinite(raw.listAmount)
        ? raw.listAmount
        : null,
    pendingPaymentCode: raw.pendingPaymentCode ?? null,
    pendingPaymentLabel: raw.pendingPaymentLabel ?? null,
    pendingTradeNo: raw.pendingTradeNo ?? null,
    pendingPaymentExpireAt: raw.pendingPaymentExpireAt ?? null,
    renewalToken: raw.renewalToken ?? null,
    periodTradeNo: raw.periodTradeNo ?? null,
    cancelledAt: raw.cancelledAt ?? null,
    cancelReason: raw.cancelReason ?? null,
    trialStartedAt: raw.trialStartedAt ?? null,
    trialEndsAt: raw.trialEndsAt ?? null,
    billingCreditBalance:
      typeof raw.billingCreditBalance === "number" &&
      Number.isFinite(raw.billingCreditBalance)
        ? Math.max(0, Math.round(raw.billingCreditBalance))
        : 0,
    referralCodeUsed: raw.referralCodeUsed
      ? String(raw.referralCodeUsed).trim().toUpperCase() || null
      : null,
    referralDiscountApplied:
      typeof raw.referralDiscountApplied === "number" &&
      Number.isFinite(raw.referralDiscountApplied)
        ? Math.max(0, Math.round(raw.referralDiscountApplied))
        : 0,
    expiryReminderForExpiresAt: raw.expiryReminderForExpiresAt
      ? String(raw.expiryReminderForExpiresAt).slice(0, 10)
      : null,
    expiryReminderD1ForExpiresAt: raw.expiryReminderD1ForExpiresAt
      ? String(raw.expiryReminderD1ForExpiresAt).slice(0, 10)
      : null,
    expiryReminderSentAt: raw.expiryReminderSentAt ?? null,
  };
}

/** 是否仍在免費試用（尚未成功付款且試用截止未到） */
export function isTenantOnTrial(
  tenant: Pick<
    TenantRecord,
    "trialEndsAt" | "lastPaymentAt" | "status" | "cancelledAt"
  > | null | undefined,
  now = new Date(),
) {
  if (!tenant?.trialEndsAt) return false;
  if (tenant.lastPaymentAt) return false;
  if (tenant.cancelledAt) return false;
  if (tenant.status === "Suspended") return false;
  const end = new Date(tenant.trialEndsAt).getTime();
  if (Number.isNaN(end)) return false;
  return end > now.getTime();
}

/** 方案到期日（日末，UTC 對齊 YYYY-MM-DD）是否已過 */
export function isTenantExpiredByDate(
  tenant: Pick<TenantRecord, "expiresAt" | "nextBillingDate"> | null | undefined,
  now = new Date(),
) {
  if (!tenant) return false;
  const endMs = tenant.nextBillingDate
    ? new Date(tenant.nextBillingDate).getTime()
    : tenant.expiresAt
      ? new Date(`${tenant.expiresAt}T23:59:59.999Z`).getTime()
      : NaN;
  if (Number.isNaN(endMs)) return false;
  return endMs < now.getTime();
}

/** 是否仍在「忘記續費保留網站」寬限內 */
export function isWithinGracePeriod(
  tenant: Pick<TenantRecord, "gracePeriodEndsAt"> | null | undefined,
  now = new Date(),
) {
  if (!tenant?.gracePeriodEndsAt) return false;
  const end = new Date(tenant.gracePeriodEndsAt).getTime();
  if (Number.isNaN(end)) return false;
  return end > now.getTime();
}

/**
 * 前台是否應暫停：
 * 僅 Suspended，或已過期且寬限已結束。
 * 寬限 30 天內保留網站（含前台）。
 */
export function isTenantBookingSuspended(
  tenant: TenantRecord | null | undefined,
  now = new Date(),
) {
  if (!tenant) return false;
  if (tenant.status === "Suspended") return true;
  if (isTenantOnTrial(tenant, now)) return false;
  if (isWithinGracePeriod(tenant, now)) return false;
  if (isTenantExpiredByDate(tenant, now)) return true;
  return false;
}

/** subscriptions.status：active / expired / trial */
export function resolveSubscriptionLifecycleStatus(
  tenant: TenantRecord,
  now = new Date(),
): SubscriptionLifecycleStatus {
  if (isTenantOnTrial(tenant, now)) return "trial";
  if (tenant.status === "Suspended" || isTenantExpiredByDate(tenant, now)) {
    return "expired";
  }
  return "active";
}

export function toSubscriptionRow(
  tenant: TenantRecord,
  now = new Date(),
): SubscriptionRow {
  return {
    store_id: tenant.storeId,
    expires_at: tenant.expiresAt,
    status: resolveSubscriptionLifecycleStatus(tenant, now),
    operational_status: tenant.status,
    next_billing_date: tenant.nextBillingDate,
    trial_ends_at: tenant.trialEndsAt,
  };
}

/** 距離到期還有幾天（負數＝已過期）；無到期日回 null */
export function daysUntilExpiry(
  tenant: Pick<TenantRecord, "expiresAt">,
  now = new Date(),
) {
  if (!tenant.expiresAt) return null;
  const exp = new Date(`${tenant.expiresAt}T00:00:00.000Z`).getTime();
  if (Number.isNaN(exp)) return null;
  const start = new Date(
    `${now.toISOString().slice(0, 10)}T00:00:00.000Z`,
  ).getTime();
  return Math.round((exp - start) / (24 * 60 * 60 * 1000));
}

export function toTenantDbRow(tenant: TenantRecord): TenantDbRow {
  return {
    store_id: tenant.storeId,
    plan_type: tenant.planType,
    status: tenant.status,
    next_billing_date: tenant.nextBillingDate,
    grace_period_ends_at: tenant.gracePeriodEndsAt,
    merchant_member_id: tenant.merchantMemberId,
    expires_at: tenant.expiresAt,
    subscription_status: resolveSubscriptionLifecycleStatus(tenant),
  };
}

export const SEED_TENANTS: TenantRecord[] = [
  normalizeTenant({
    id: "t-brunch",
    storeId: "brunch-house",
    name: "巷弄晨光 Brunch House",
    slug: "brunch-house",
    planType: "self-serve",
    status: "Active",
    expiresAt: "2027-03-31",
    nextBillingDate: "2027-03-31T00:00:00.000Z",
    merchantMemberId: "MEM-BRUNCH-001",
    cardToken: "tok_demo_brunch",
    lastPaymentAt: "2026-03-01T02:00:00.000Z",
    pageViews: 12840,
    ownerEmail: "owner.brunch@demo.tw",
    createdAt: "2026-01-15T00:00:00.000Z",
  }),
  normalizeTenant({
    id: "t-nail",
    storeId: "nail-studio",
    name: "澄光美甲 Nail Studio",
    slug: "nail-studio",
    planType: "self-serve",
    status: "Active",
    expiresAt: "2026-12-31",
    nextBillingDate: "2026-12-31T00:00:00.000Z",
    merchantMemberId: "MEM-NAIL-001",
    cardToken: "tok_demo_nail",
    lastPaymentAt: "2026-02-01T02:00:00.000Z",
    pageViews: 6420,
    ownerEmail: "owner.nail@demo.tw",
    createdAt: "2026-02-01T00:00:00.000Z",
  }),
  normalizeTenant({
    id: "t-select",
    storeId: "select-shop",
    name: "脈線美睫 Pulse Lash",
    slug: "select-shop",
    planType: "self-serve",
    status: "Active",
    expiresAt: "2027-06-30",
    nextBillingDate: "2027-06-30T00:00:00.000Z",
    merchantMemberId: "MEM-LASH-001",
    cardToken: "tok_demo_lash",
    lastPaymentAt: "2026-03-10T02:00:00.000Z",
    pageViews: 9150,
    ownerEmail: "owner.lash@demo.tw",
    createdAt: "2026-03-10T00:00:00.000Z",
  }),
];

export function slugifyStoreName(input: string) {
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

export function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2;
}

export function nextStatus(current: TenantStatus): TenantStatus {
  if (current === "Active") return "Suspended";
  if (current === "Suspended") return "Active";
  return "Active";
}

export function statusTone(status: TenantStatus) {
  if (status === "Active") {
    return "border-emerald-400/30 bg-emerald-400/15 text-emerald-200";
  }
  if (status === "Pending") {
    return "border-amber-400/30 bg-amber-400/15 text-amber-100";
  }
  return "border-rose-400/30 bg-rose-400/15 text-rose-100";
}

export function billingDatesAfterSuccess(from = new Date(), days = 30) {
  const next = addDaysDateOnly(from, Math.max(1, days));
  return {
    nextBillingDate: `${next}T00:00:00.000Z`,
    expiresAt: next,
    lastPaymentAt: from.toISOString(),
    gracePeriodEndsAt: null as string | null,
  };
}

export function billingDatesAfterFailure(from = new Date()) {
  const graceDays = Number.isFinite(GRACE_PERIOD_DAYS) ? GRACE_PERIOD_DAYS : 30;
  return {
    gracePeriodEndsAt: addDaysIso(from, graceDays),
  };
}

export function planMonthlyAmount(_planType?: TenantPlanType) {
  // 旗艦預設月費 $499；基礎版 $299 由結帳／轉帳 API 以 planId／planName 覆寫
  void _planType;
  return 499;
}
