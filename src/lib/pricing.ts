export type PricingPlan = {
  id: string;
  name: string;
  enName: string;
  monthlyPrice: number;
  suitable: string;
  features: string[];
  /** 方案卡醒目標籤（如核心預約能力） */
  badges?: string[];
  cta: string;
  recommended?: boolean;
};

export type PricingCategory = {
  id: "self-serve";
  label: string;
  enLabel: string;
  description: string;
  plans: PricingPlan[];
};

/** @deprecated 已專注實體預約；保留型別相容舊 URL／報價邏輯 */
export type MarketTypeId = "physical" | "shop";

export type MarketType = {
  id: MarketTypeId;
  label: string;
  enLabel: string;
  description: string;
};

/** 僅實體服務業；網拍業態已下架 */
export const marketTypes: MarketType[] = [
  {
    id: "physical",
    label: "📍 實體服務業",
    enLabel: "Beauty & Studios",
    description:
      "專為美甲、美睫、沙龍與個人工作室設計：線上預約導流、刮刮樂留客、LINE 雙向通知與 VIP 熟客名單。",
  },
];

export const PRICING_NOTE =
  "所有方案皆可隨時升降級。流程為先註冊再開通試用。訂閱費用為拓脈平台月費／年費，與店內現場收款無關。年繳以主站價目為準；前 15 組創始含 14 天免費試用後續費 8 折，額滿後新客 3 天試用。忘記續費可保留網站 30 天。";

/** @deprecated 網拍方案已下架；保留常數避免舊匯入炸掉 */
export const SHOP_PRICING_NOTE =
  "網拍／周邊電商方案已下架。拓脈目前專注實體服務業預約導流。";

/** 拓脈商務聯絡信箱 */
export const BUSINESS_EMAIL =
  process.env.NEXT_PUBLIC_BUSINESS_EMAIL?.trim() || "archer0965@gmail.com";

/** 拓脈官方 LINE ID */
export const LINE_OFFICIAL_ID =
  process.env.NEXT_PUBLIC_LINE_ID?.trim() || "@469uykad";

/** 拓脈官方 LINE 加好友連結（手機／桌面皆可用） */
export const LINE_FRIEND_URL =
  process.env.NEXT_PUBLIC_LINE_URL?.trim() ||
  `https://line.me/R/ti/p/${
    LINE_OFFICIAL_ID.startsWith("@") ? LINE_OFFICIAL_ID : `@${LINE_OFFICIAL_ID}`
  }`;

/**
 * 年繳以 NovaOS 主站為權威：月費 × 12（與 paycheck.com.de CENTRAL_PLANS 對齊）
 * 例：299 → 3,588；499 → 5,988
 */
export function annualPrice(monthly: number) {
  return Math.round(monthly * 12);
}

export function annualMonthlyEquivalent(monthly: number) {
  return Math.round(annualPrice(monthly) / 12);
}

export type PricingBillingCycle = "monthly" | "annual";

export function formatTwd(amount: number) {
  return `NT$ ${amount.toLocaleString("zh-TW")}`;
}

/**
 * 創始續費折扣倍率（應付 = 原價 × rate）。
 * 0.8 = 終身續費 8 折。
 */
export const FOUNDING_MEMBER_RATE = 0.8;

/** 創始名額上限；湊滿後結帳不再顯示創始選項 */
export const FOUNDING_MEMBER_LIMIT = 15;

/**
 * @deprecated 創始改為試用後按 8 折續費，不再一次免付費多年；保留常數相容舊引用
 */
export const FOUNDING_FREE_YEARS = 10;

/** 創始會員免費試用天數 */
export const FOUNDING_TRIAL_DAYS = 14;

/** 創始額滿後一般新店免費試用天數 */
export const STANDARD_TRIAL_DAYS = 3;

/** @deprecated 請改用 FOUNDING_TRIAL_DAYS／STANDARD_TRIAL_DAYS；保留相容舊文案 */
export const TRIAL_DAYS = FOUNDING_TRIAL_DAYS;

export const TRIAL_LABEL = "免費全功能試用期";

export const FOUNDING_FREE_LABEL = "前 15 組創始：14 天免費＋續費終身 8 折";

/** 依是否創始回傳試用天數 */
export function trialDaysFor(isFoundingMember: boolean) {
  return isFoundingMember ? FOUNDING_TRIAL_DAYS : STANDARD_TRIAL_DAYS;
}

/** 前 15 組創始優惠項目（主頁浮動框／定價文案共用） */
export const FOUNDING_BENEFITS = [
  `前 ${FOUNDING_TRIAL_DAYS} 天免費全功能試用`,
  "試用結束後每次續費終身 8 折",
  "試用到期前 3 天與前 1 天自動提醒續約",
  "創始終身資格：升降級後續費仍享 8 折",
  "忘記續費可保留網站 30 天",
  "綠界線上付款（信用卡／定期定額／ATM／超商）",
] as const;

/**
 * 付款型別（訂閱正式通路為綠界：period／credit／atm／cvs）。
 */
export type CheckoutPaymentType =
  | "bank_transfer"
  | "period"
  | "credit"
  | "atm"
  | "cvs";

export type LegacyCheckoutPaymentType = CheckoutPaymentType | "onetime";

/**
 * 創始會員應付金額：終身續費 8 折（原價 × FOUNDING_MEMBER_RATE）；
 * 非創始則回傳原價（至少 1 元）。
 * 注意：前 14 天試用期應付為 0，由試用流程處理，不經此函式。
 */
export function applyFoundingDiscount(
  amount: number,
  isFoundingMember: boolean,
) {
  const base = Math.max(0, Math.round(Number(amount) || 0));
  if (!isFoundingMember) return Math.max(1, base);
  return Math.max(1, Math.round(base * FOUNDING_MEMBER_RATE));
}

/** 訂閱結帳：正規化為綠界付款型別（預設信用卡；bank_transfer 一律改 credit） */
export function normalizeSubscriptionPaymentType(
  value?: string | null,
): Exclude<CheckoutPaymentType, "bank_transfer"> {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "period") return "period";
  if (v === "atm") return "atm";
  if (v === "cvs") return "cvs";
  // bank_transfer／onetime／空白／未知 → 綠界信用卡
  if (v === "credit" || v === "onetime" || v === "bank_transfer" || !v) {
    return "credit";
  }
  return "credit";
}

/** 解析付款型別（含歷史 bank_transfer） */
export function normalizeCheckoutPaymentType(
  value?: string | null,
): CheckoutPaymentType {
  if (value === "bank_transfer") return "bank_transfer";
  if (value === "atm") return "atm";
  if (value === "cvs") return "cvs";
  if (value === "period") return "period";
  if (value === "credit" || value === "onetime") return "credit";
  return "credit";
}

/** 表單／CTA 共用的方案標籤（例：極速預約基礎版 $299） */
export function planSelectionLabel(
  _category: PricingCategory | { id: string; label: string },
  plan: PricingPlan,
) {
  const price = `$${plan.monthlyPrice.toLocaleString("en-US")}`;
  return `${plan.name} ${price}`;
}

export const STORE_TYPE_OPTIONS = [
  "美甲／美睫",
  "美髮沙龍",
  "美容／皮膚管理",
  "個人工作室／整體造型",
  "其他實體服務",
] as const;

export type StoreTypeOption = (typeof STORE_TYPE_OPTIONS)[number];

export const UNDECIDED_PLAN_OPTION = "還在猶豫需要建議";

/** 聯絡表單「感興趣的方案」選項 */
export function interestedPlanOptions(): string[] {
  const fromPricing = pricingCategories.flatMap((category) =>
    category.plans.map((plan) => planSelectionLabel(category, plan)),
  );
  return [...fromPricing, UNDECIDED_PLAN_OPTION];
}

/** 將 URL／事件帶入的方案字串對應到表單選項 */
export function resolveInterestedPlan(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const options = interestedPlanOptions();
  if (options.includes(value)) return value;

  const compact = value.replace(/[・·\s]/g, "").toLowerCase();
  const hit = options.find((option) => {
    const opt = option.replace(/[・·\s]/g, "").toLowerCase();
    return (
      opt === compact ||
      opt.includes(compact) ||
      compact.includes(opt.replace(/\$[\d,]+/g, ""))
    );
  });
  return hit ?? value;
}

/** 方案頁核心預約能力說明 */
export const BOOKING_CORE_FEATURES = [
  {
    id: "booking",
    title: "線上極速預約",
    desc: "顧客可選服務項目、指定服務人員／設計師與時段；系統自動防重疊，降低人工排程錯誤。",
  },
  {
    id: "scratch",
    title: "手機刮刮樂留客",
    desc: "預約完成或到店體驗後掃碼玩刮刮樂領優惠券，把首次體驗轉成二次回訪。",
  },
  {
    id: "line",
    title: "✨ LINE 自動化雙向通知",
    desc: "顧客端：預約成功通知＋到店／服務行前 LINE 提醒（降低放鳥）。店家端：新預約即時推播（LINE／Email）給店家與對應服務人員，方便第一時間確認接單。",
  },
  {
    id: "vip",
    title: "VIP 熟客名單回收",
    desc: "顧客資料庫與歷史預約紀錄集中管理，方便回訪關懷與檔期行銷。",
  },
] as const;

/** @deprecated 網拍功能已下架；空陣列供舊匯入相容 */
export const SHOP_CORE_FEATURES = [] as const;

/** @deprecated */
export const SHOP_FEE_TERMS = {
  commission: "網拍平台抽成條款已下架。",
  convenience: "超商取貨物流條款已下架。",
  payout: "網拍撥款條款已下架。",
  shipping: "超商出貨條款已下架。",
} as const;

/** @deprecated */
export const SHOP_FEE_BULLETS = [] as const;

/** 純預約自主經營雙方案：極速預約基礎版 × 品牌導流旗艦版 */
export const pricingCategories: PricingCategory[] = [
  {
    id: "self-serve",
    label: "自主經營",
    enLabel: "Self-Serve",
    description:
      "基礎版打通預約與通知；旗艦版加上微型官網與刮刮樂留客。先註冊再開通：前 15 組創始 14 天試用後續費 8 折；額滿後 3 天試用。",
    plans: [
      {
        id: "starter",
        name: "極速預約基礎版",
        enName: "Booking Express",
        monthlyPrice: 299,
        suitable: "想先把預約與通知自動化、一天不到 10 元的小型工作室",
        features: [
          "線上極速預約表單（項目／時段選取／防重疊鎖定）",
          "預約成功後台與 LINE 即時自動推播通知",
          "✨ 每日晚間自動彙整推播隔日預約行程",
          "賣家管理後台（預約訂單數統計＋視覺化日曆細節）",
        ],
        badges: ["先註冊可試用", "一天不到10元・省時首選"],
        cta: "先註冊・申請試用",
      },
      {
        id: "growth",
        name: "品牌導流旗艦版",
        enName: "Brand Flagship",
        monthlyPrice: 499,
        suitable: "需要品牌微型官網、刮刮樂留客與 LINE 導流的美業門市",
        features: [
          "含【極速預約基礎版】全部功能",
          "✨ 專屬品牌形象微型官網（自訂風格／作品與價目表展示）",
          "✨ 行銷活動與手機互動刮刮樂（熟客留客與 LINE 導流）",
        ],
        badges: ["🔥 創始限定特惠價 $499/月", "先註冊可試用"],
        cta: "先註冊・申請試用",
        recommended: true,
      },
    ],
  },
];

/**
 * @deprecated 網拍方案已下架。保留空 plans，避免舊報價／匯入直接炸掉。
 */
export const shopPricingCategory = {
  id: "shop" as const,
  label: "網拍系列（已下架）",
  enLabel: "Pulse Shop (Retired)",
  description: "網拍／周邊電商方案已下架。請改選實體服務業預約方案。",
  plans: [] as PricingPlan[],
};

export const PRICING_FAQS = [
  {
    id: "q0",
    question: "前十組註冊真的不用付費嗎？和免費試用有什麼差別？",
    answer: `創始名額限量 ${FOUNDING_MEMBER_LIMIT} 組：前 ${FOUNDING_TRIAL_DAYS} 天免費全功能試用，試用結束後每次續費終身 8 折。試用結束前 3 天與前 1 天會通知賣家，若已續費則略過提醒。額滿後新客改為 ${STANDARD_TRIAL_DAYS} 天免費試用（剩餘 1 天提醒），結束後需以綠界依原價訂閱。忘記續費時網站可保留 30 天。`,
  },
  {
    id: "q1",
    question: "我可以隨時升降級或更換方案嗎？",
    answer:
      "可以。極速預約基礎版與品牌導流旗艦版皆支援評估後轉換。升級原則上立即生效並依剩餘天數比例計費；降級則於下一個計費週期生效。若您為創始會員，升降級後續費仍維持終身 8 折。",
  },
  {
    id: "q2",
    question: "線上預約會不會撞時段？",
    answer:
      "兩種方案皆含時段防重疊鎖定：已額滿或已被預約的時段會以灰底禁用，避免同一時段重複預約。",
  },
  {
    id: "q3",
    question: "LINE 雙向通知是怎麼運作的？",
    answer:
      "顧客完成預約後，系統推播預約成功與行前提醒；店家／服務人員則即時收到新預約細節。基礎版另含每日晚間彙整隔日行程推播，方便隔天開工前一次確認。",
  },
  {
    id: "q4",
    question: "刮刮樂是哪個方案才有？",
    answer:
      "手機互動刮刮樂與品牌微型官網屬於品牌導流旗艦版。基礎版專注預約表單、防重疊與通知自動化。",
  },
  {
    id: "q5",
    question: "還有其他方案或網拍金物流嗎？",
    answer:
      "沒有。拓脈僅提供極速預約基礎版與品牌導流旗艦版兩種純預約方案，不提供網拍購物車或超商金物流。",
  },
  {
    id: "q6",
    question: "網站建置好之後，網址會是什麼格式？",
    answer:
      "預設提供拓脈子網域，例如 taiwanbiz.vercel.app/stores/您的店家代號。旗艦版可協助綁定自有品牌網域。正式網址與上線時程會在諮詢後確認。",
  },
  {
    id: "q7",
    question: "年繳方案的優惠折扣是怎麼計算的？",
    answer:
      "年繳以 NovaOS 主站為準（月費 × 12）：基礎版 NT$3,588；旗艦版 NT$5,988。前 15 組創始試用後續費再享 8 折。",
  },
];
