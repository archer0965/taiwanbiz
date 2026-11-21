import type {
  ShopProduct,
  StoreCampaign,
  StoreMode,
  StoreTheme,
} from "@/data/stores-db";
import type {
  CareRetargetingSettings,
  StoreBlacklistEntry,
  StoreCustomerCrm,
  StoreStaffMember,
} from "@/lib/beauty-ops";
import type {
  BusinessHoursSettings,
} from "@/lib/business-hours";
import type { DepositSettings } from "@/lib/deposit-settings";
import type { LeadRecord, StoreSettings } from "@/lib/mock-data";
import type { OffPeakDiscountSettings } from "@/lib/off-peak-discounts";
import type { ShopPromo } from "@/lib/shop-promos";
import type { StoreStyleSettings } from "@/lib/store-style";

export type StoreContentRecord = {
  slug: string;
  updatedAt: string;
  profile: StoreSettings;
  mode: StoreMode;
  theme: StoreTheme;
  shopProducts: ShopProduct[];
  campaign: StoreCampaign & { createdAt?: string };
  /** 網拍優惠活動（折扣碼／自動套用，串接結帳訂單） */
  shopPromos: ShopPromo[];
  leads: LeadRecord[];
  prizeStock: Record<string, number>;
  claimedPhones: string[];
  contactSubmissions: Array<{
    id: string;
    createdAt: string;
    name: string;
    phone: string;
    message: string;
  }>;
  /** 營業時間、公休、特別休假與緩衝 */
  businessHours?: BusinessHoursSettings;
  /** 離峰時段自動優惠 */
  offPeakDiscount?: OffPeakDiscountSettings;
  /** 前台渲染覆寫：basic 純預約／premium 品牌官網（空白則依訂閱方案） */
  storefrontPreset?: "basic" | "premium";
  /** 前台預約須知（買家必勾同意） */
  bookingTerms?: string;
  /** 可指定之服務人員／設計師 */
  staff?: StoreStaffMember[];
  /** 防放鳥黑名單 */
  blacklists?: StoreBlacklistEntry[];
  /** VIP 顧客 CRM（儲值／包套備註／髮況配方） */
  customers?: StoreCustomerCrm[];
  /**
   * 預約訂金開關：免訂金／手動匯款／綠界（含 LINE Pay 等線上通路）
   * 與平台訂閱金流無關
   */
  depositSettings?: DepositSettings;
  /** 前台網站風格自訂（色票／字體／氛圍／圓角） */
  storeStyle?: StoreStyleSettings;
  /** 燙染後自動回護理推播 */
  careRetargeting?: CareRetargetingSettings;
  /** Google 商家評論連結（課後好評導流） */
  reviewUrl?: string;
  /** IG 標記優惠文案（課後關心） */
  reviewIgHint?: string;
  /** 店家撥款帳戶（Pulse Shop） */
  payout: {
    bankCode: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    taxId: string;
  };
  /** 運費由誰負擔（綠界建單仍先從賣家物流帳戶扣運費；買家付則加進應付／代收金額） */
  shipping: StoreShippingSettings;
};

export type ShippingPayer = "buyer" | "seller";

export type StoreShippingSettings = {
  /** buyer＝結帳加收運費；seller＝賣家自行吸收 */
  payer: ShippingPayer;
  /** 超商取貨運費（未稅參考約 65） */
  cvsFee: number;
  /** 宅配運費（賣家自訂；買家付時加收） */
  homeFee: number;
};

export type ShopOrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";

export type ShopOrderLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  colorId?: string;
  colorName?: string;
};

export type ShopOrder = {
  id: string;
  storeSlug: string;
  createdAt: string;
  updatedAt: string;
  status: ShopOrderStatus;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickup: "711" | "family" | "home";
  storeCode?: string;
  storeName?: string;
  address?: string;
  payment: "credit" | "atm" | "cod";
  note?: string;
  lines: ShopOrderLine[];
  /** 商品小計（折抵前、不含運費） */
  subtotal: number;
  /** 優惠折抵金額 */
  discountAmount?: number;
  promoId?: string | null;
  promoCode?: string | null;
  promoName?: string | null;
  /** 向買家加收的運費（賣家吸收／免運時為 0）；舊訂單可能缺省 */
  shippingFee?: number;
  shippingPayer?: ShippingPayer;
  /** 買家應付＝subtotal - discount + shippingFee */
  totalAmount?: number;
  /** 平台抽成 3%（以折抵後商品金額計算） */
  commissionAmount: number;
  /** 綠界／物流手續費估算（對帳用，實際以綠界為準） */
  paymentFeeEstimate: number;
  /** 應撥店家金額（subtotal + shippingFee - commission - fee） */
  payoutAmount: number;
  tradeNo?: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  completedAt?: string | null;
  paymentCode?: string | null;
  paymentExpireAt?: string | null;
  /** 綠界物流 AllPayLogisticsID */
  logisticsId?: string | null;
  /** 建立物流時的 MerchantTradeNo */
  logisticsTradeNo?: string | null;
  logisticsSubType?: string | null;
  /** 7-11 C2C 交貨便代碼／驗證碼（列印用） */
  cvsPaymentNo?: string | null;
  cvsValidationNo?: string | null;
  logisticsStatus?: string | null;
  logisticsCreatedAt?: string | null;
};

export type PayoutBatch = {
  id: string;
  storeSlug: string;
  periodLabel: string;
  createdAt: string;
  settledAt: string;
  orderIds: string[];
  grossAmount: number;
  commissionAmount: number;
  feeAmount: number;
  netAmount: number;
  status: "pending" | "paid";
};

export const SHOP_COMMISSION_RATE = 0.03;

export function emptyPayout() {
  return {
    bankCode: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    taxId: "",
  };
}

export function emptyShipping(): StoreShippingSettings {
  return {
    payer: "buyer",
    cvsFee: 65,
    homeFee: 80,
  };
}

export function normalizeShippingSettings(
  raw?: Partial<StoreShippingSettings> | null,
): StoreShippingSettings {
  const base = emptyShipping();
  const payer = raw?.payer === "seller" ? "seller" : "buyer";
  const cvsFee = Math.max(
    0,
    Math.min(2000, Math.round(Number(raw?.cvsFee ?? base.cvsFee) || 0)),
  );
  const homeFee = Math.max(
    0,
    Math.min(5000, Math.round(Number(raw?.homeFee ?? base.homeFee) || 0)),
  );
  return { payer, cvsFee, homeFee };
}

export function resolveOrderShippingFee(
  pickup: ShopOrder["pickup"],
  shipping: StoreShippingSettings,
) {
  const settings = normalizeShippingSettings(shipping);
  if (settings.payer === "seller") {
    return { shippingPayer: "seller" as const, shippingFee: 0 };
  }
  const shippingFee =
    pickup === "home" ? settings.homeFee : settings.cvsFee;
  return { shippingPayer: "buyer" as const, shippingFee };
}

export function computeShopFees(
  subtotal: number,
  payment: "credit" | "atm" | "cod",
  opts?: {
    shippingFee?: number;
    discountAmount?: number;
    pickup?: ShopOrder["pickup"];
  },
) {
  const gross = Math.max(0, Math.round(subtotal));
  const discountAmount = Math.min(
    gross,
    Math.max(0, Math.round(opts?.discountAmount ?? 0)),
  );
  const product = Math.max(0, gross - discountAmount);
  const shippingFee = Math.max(0, Math.round(opts?.shippingFee ?? 0));
  const totalAmount = product + shippingFee;
  const commissionAmount =
    product <= 0 ? 0 : Math.max(1, Math.round(product * SHOP_COMMISSION_RATE));
  // 估算：信用卡約 2.5%（以應付總額）；ATM 約 15；超商物流運費約 65（賣家綠界帳戶實扣）
  const paymentFeeEstimate =
    payment === "credit"
      ? Math.max(5, Math.round(totalAmount * 0.025))
      : payment === "cod" || opts?.pickup === "711" || opts?.pickup === "family"
        ? 65
        : 15;
  const payoutAmount = Math.max(
    0,
    product + shippingFee - commissionAmount - paymentFeeEstimate,
  );
  return {
    commissionAmount,
    paymentFeeEstimate,
    payoutAmount,
    shippingFee,
    discountAmount,
    totalAmount,
  };
}
