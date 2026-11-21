import {
  BUSINESS_EMAIL,
  LINE_OFFICIAL_ID,
  formatTwd,
  planSelectionLabel,
  pricingCategories,
  TRIAL_DAYS,
  TRIAL_LABEL,
} from "@/lib/pricing";
import {
  PLAN_TYPE_LABELS,
  planMonthlyAmount,
  type TenantPlanType,
  type TenantRecord,
} from "@/lib/tenants";

/** 甲方（服務商）固定資訊 */
export const QUOTATION_PARTY_A = {
  brandZh: "拓脈",
  brandEn: "Nova Crest Pulse",
  legalName: "拓脈（Nova Crest Pulse）",
  email: BUSINESS_EMAIL,
  lineId: LINE_OFFICIAL_ID,
  role: "服務商／平台方（甲方）",
} as const;

export type QuotationPartyB = {
  storeName: string;
  contactName: string;
  phone: string;
  lineId: string;
  email: string;
  storeId: string;
};

export type QuotationPlanDetail = {
  planType: TenantPlanType;
  seriesLabel: string;
  planName: string;
  planLabel: string;
  monthlyPrice: number;
  monthlyPriceLabel: string;
  /** 創始優惠建置費 */
  setupFee: number;
  setupFeeLabel: string;
  /** 平台抽成比例（預約方案為 null） */
  commissionRate: number | null;
  commissionLabel: string;
  /** 服務／維運範圍說明 */
  serviceScope: string;
};

export type QuotationDocument = {
  quotationNo: string;
  issuedAt: string;
  partyA: typeof QUOTATION_PARTY_A;
  partyB: QuotationPartyB;
  plan: QuotationPlanDetail;
  founderPromo: {
    trialDays: number;
    trialLabel: string;
    founderSlots: number;
    founderDiscount: string;
    founderLabel: string;
  };
  termsSummary: string[];
};

const DEMO_CONTACTS: Record<
  string,
  Partial<Pick<QuotationPartyB, "contactName" | "phone" | "lineId">>
> = {
  "brunch-house": {
    contactName: "晨光店長",
    phone: "0912-345-678",
    lineId: "@brunch-house",
  },
  "nail-studio": {
    contactName: "澄光負責人",
    phone: "0987-654-321",
    lineId: "@nail-studio",
  },
  "select-shop": {
    contactName: "脈線美睫主理人",
    phone: "0955-112-233",
    lineId: "@pulselash",
  },
};

function guessContactName(email: string, storeName: string) {
  const local = email.split("@")[0]?.trim();
  if (!local) return storeName;
  if (local.startsWith("owner.")) {
    return storeName.replace(/\s+[A-Za-z].*$/, "").trim() || storeName;
  }
  return local;
}

export function resolvePartyB(tenant: TenantRecord): QuotationPartyB {
  const demo = DEMO_CONTACTS[tenant.storeId] ?? DEMO_CONTACTS[tenant.slug];
  return {
    storeName: tenant.name,
    contactName: demo?.contactName || guessContactName(tenant.ownerEmail, tenant.name),
    phone: demo?.phone || "（請填寫）",
    lineId: demo?.lineId || "（請填寫）",
    email: tenant.ownerEmail,
    storeId: tenant.storeId,
  };
}

function resolvePlanDetail(planType: TenantPlanType): QuotationPlanDetail {
  const category = pricingCategories.find((c) => c.id === "self-serve")!;
  const plan =
    category.plans.find((p) => p.recommended) || category.plans[1] || category.plans[0];
  const monthly = planMonthlyAmount(planType);
  return {
    planType: "self-serve",
    seriesLabel: "自主預約",
    planName: plan.name,
    planLabel: planSelectionLabel(category, plan),
    monthlyPrice: monthly,
    monthlyPriceLabel: formatTwd(monthly),
    setupFee: 0,
    setupFeeLabel: "NT$ 0（創始優惠）",
    commissionRate: null,
    commissionLabel: "不適用（預約導流方案，無商品交易抽成）",
    serviceScope:
      "自主維運：店家自行於後台維護服務項目、預約時段與（旗艦版）刮刮樂活動；甲方提供系統、教學與客服支援。",
  };
}

export function buildQuotationNumber(storeId: string, issuedAt = new Date()) {
  const y = issuedAt.getFullYear();
  const m = String(issuedAt.getMonth() + 1).padStart(2, "0");
  const d = String(issuedAt.getDate()).padStart(2, "0");
  const slug = storeId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "STORE";
  return `NCP-QT-${y}${m}${d}-${slug}`;
}

export function buildQuotationDocument(
  tenant: TenantRecord,
  issuedAt = new Date(),
): QuotationDocument {
  const plan = resolvePlanDetail(tenant.planType);
  return {
    quotationNo: buildQuotationNumber(tenant.storeId, issuedAt),
    issuedAt: issuedAt.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    partyA: QUOTATION_PARTY_A,
    partyB: resolvePartyB(tenant),
    plan,
    founderPromo: {
      trialDays: TRIAL_DAYS,
      trialLabel: TRIAL_LABEL,
      founderSlots: 10,
      founderDiscount: "續費終身 8 折",
      founderLabel:
        "創始會員限量 10 組：前 14 天免費試用，之後每次續費終身 8 折；額滿後新客 3 天試用後依原價",
    },
    termsSummary: [
      `服務方案：${PLAN_TYPE_LABELS[tenant.planType]}（${plan.seriesLabel}／${plan.planName}）。${plan.serviceScope}`,
      "拓脈訂閱費用為平台月費／年費；店內服務現場收費由店家自行處理，本方案不含周邊商品購物車或超商金物流。",
      "旗艦尊榮方案得依規格啟用 LINE 雙向通知（顧客預約成功／行前提醒，以及店家與服務人員新預約即時推播）。",
      "忘記續費時網站可保留 30 天；寬限結束仍未補繳者，系統得將服務暫停（Suspended），直至補繳並經確認後恢復。",
      "流程為先註冊再開通試用。前 15 組創始：14 天免費試用後續費終身 8 折；額滿後新客 3 天試用。試用與創始資格以本確認單記載及後續正式訂單為準。",
      "本確認單為服務報價與契約摘要，詳細權利義務並參照拓脈《服務條款》與《隱私權政策》。",
    ],
  };
}
