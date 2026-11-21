import {
  applyFoundingDiscount,
  normalizeCheckoutPaymentType,
  type CheckoutPaymentType,
} from "@/lib/pricing";
import { planMonthlyAmount, type TenantPlanType } from "@/lib/tenants";
import { createHash } from "crypto";
import { isValidTaiwanMobile, normalizeTaiwanMobile } from "@/lib/phone";

export {
  applyFoundingDiscount,
  FOUNDING_MEMBER_RATE,
  FOUNDING_MEMBER_LIMIT,
  normalizeCheckoutPaymentType,
  type CheckoutPaymentType,
} from "@/lib/pricing";

/** 綠界 ECPay 定期定額／信用卡設定（未設定憑證時走 mock） */
export function ecpayConfigured() {
  return Boolean(
    process.env.ECPAY_MERCHANT_ID?.trim() &&
      process.env.ECPAY_HASH_KEY?.trim() &&
      process.env.ECPAY_HASH_IV?.trim(),
  );
}

export function ecpayMode() {
  return ecpayConfigured() && process.env.ECPAY_FORCE_MOCK !== "true"
    ? ("live" as const)
    : ("mock" as const);
}

function hashKey() {
  return process.env.ECPAY_HASH_KEY?.trim() || "demo-hash-key";
}

function hashIv() {
  return process.env.ECPAY_HASH_IV?.trim() || "demo-hash-iv";
}

export function merchantId() {
  return process.env.ECPAY_MERCHANT_ID?.trim() || "3002607";
}

export function siteBaseUrl() {
  return (
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://taiwanbiz.vercel.app"
  );
}

/**
 * 綠界 CheckMacValue（SHA256）
 * 官方流程：排序 → HashKey/HashIV 串接 → URL encode → 小寫 → 特殊字元還原 → SHA256 → 大寫
 */
export function buildCheckMacValue(params: Record<string, string>) {
  const sorted = Object.keys(params)
    .filter(
      (key) =>
        key !== "CheckMacValue" &&
        params[key] !== undefined &&
        params[key] !== null &&
        String(params[key]) !== "",
    )
    .sort((a, b) => (a > b ? 1 : -1))
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const raw = `HashKey=${hashKey()}&${sorted}&HashIV=${hashIv()}`;
  // 綠界金流 CheckMac 採 .NET UrlEncode：空白為 +（非 %20）
  let encoded = encodeURIComponent(raw).toLowerCase();
  encoded = encoded
    .replace(/%20/g, "+")
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");

  return createHash("sha256").update(encoded).digest("hex").toUpperCase();
}

export function verifyCheckMacValue(params: Record<string, string>) {
  const incoming = params.CheckMacValue?.toUpperCase();
  if (!incoming) return false;
  const rest = { ...params };
  delete rest.CheckMacValue;
  return buildCheckMacValue(rest) === incoming;
}

export type DynamicCheckoutInput = {
  storeId: string;
  planName: string;
  /** 折扣前月費／金額 */
  amount: number;
  isFoundingMember?: boolean;
  paymentType?: CheckoutPaymentType | "onetime";
  ownerEmail?: string;
  planType?: TenantPlanType;
  merchantMemberId?: string;
  orderId?: string;
};

export type EcpayFormPayload = {
  action: string;
  params: Record<string, string>;
  amount: number;
  listAmount: number;
  discounted: boolean;
  mode: "live" | "mock";
  paymentType: CheckoutPaymentType;
  orderId: string;
  planName: string;
  storeId: string;
};

function formatTradeDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function createMerchantMemberId(storeId: string) {
  return `MEM-${storeId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16)}-${Date.now().toString(36).toUpperCase()}`;
}

export function createCardToken(storeId: string) {
  return `tok_${storeId}_${Date.now().toString(36)}`;
}

/** 綠界 MerchantTradeNo：最長 20 碼英數 */
export function createTradeNo(storeId: string) {
  const stamp = Date.now().toString().slice(-10);
  return `TB${storeId.replace(/-/g, "").slice(0, 6)}${stamp}`.slice(0, 20);
}

export function createRenewalToken() {
  return `rn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function webhookUrl() {
  return `${siteBaseUrl()}/api/webhooks/ecpay`;
}

function paymentInfoUrl() {
  return `${siteBaseUrl()}/api/webhooks/ecpay/payment-info`;
}

function clientReturnUrl(storeId: string) {
  return `${siteBaseUrl()}/welcome?storeId=${encodeURIComponent(storeId)}`;
}

function aioActionUrl() {
  if (process.env.ECPAY_AIO_ACTION_URL?.trim()) {
    return process.env.ECPAY_AIO_ACTION_URL.trim();
  }
  // ECPAY_STAGE=true 時走測試環境（需搭配測試特店 3002607 金鑰）
  if (process.env.ECPAY_STAGE === "true") {
    return "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";
  }
  return "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5";
}

/**
 * 組裝綠界信用卡定期定額（走 AioCheckOut + Period* 參數）。
 * 舊版 /Cashier/PeriodOrder 已不適用一般特店，會回 10200074。
 */
export function buildPeriodOrderPayload(input: {
  storeId: string;
  planType?: TenantPlanType;
  planName?: string;
  amount?: number;
  isFoundingMember?: boolean;
  ownerEmail?: string;
  merchantMemberId: string;
  orderId: string;
}): EcpayFormPayload {
  const listAmount =
    input.amount ??
    (input.planType ? planMonthlyAmount(input.planType) : 999);
  const amount = applyFoundingDiscount(
    listAmount,
    Boolean(input.isFoundingMember),
  );
  const planName =
    input.planName ||
    (input.planType ? `拓脈訂閱-${input.planType}` : "拓脈訂閱");
  const itemName = `拓脈 ${planName}`.slice(0, 200);
  // TotalAmount 必須與 PeriodAmount 相同
  const pay = String(amount);

  const params: Record<string, string> = {
    MerchantID: merchantId(),
    MerchantTradeNo: input.orderId,
    MerchantTradeDate: formatTradeDate(new Date()),
    PaymentType: "aio",
    TotalAmount: pay,
    TradeDesc: `Nova Crest Pulse - ${planName}`.slice(0, 200),
    ItemName: itemName,
    ReturnURL: webhookUrl(),
    OrderResultURL: clientReturnUrl(input.storeId),
    ClientBackURL: clientReturnUrl(input.storeId),
    ChoosePayment: "Credit",
    EncryptType: "1",
    PeriodAmount: pay,
    PeriodType: "M",
    Frequency: "1",
    ExecTimes: "99",
    PeriodReturnURL: webhookUrl(),
    CustomField1: input.storeId,
    CustomField2: input.planType || "self-serve",
    CustomField3: input.ownerEmail || "",
    CustomField4: input.isFoundingMember ? "founding" : "standard",
  };
  // 記憶卡號識別碼僅在有 BindingCard=1 時使用；預設不送，避免特店未開通記憶卡號
  void input.merchantMemberId;
  params.CheckMacValue = buildCheckMacValue(params);

  return {
    action: aioActionUrl(),
    params,
    amount,
    listAmount: Math.round(listAmount),
    discounted: Boolean(input.isFoundingMember),
    mode: ecpayMode(),
    paymentType: "period",
    orderId: input.orderId,
    planName,
    storeId: input.storeId,
  };
}

/** 組裝綠界 AioCheckOut：信用卡／ATM／超商一次付清 */
export function buildAioCheckoutPayload(input: {
  storeId: string;
  planName: string;
  amount: number;
  isFoundingMember?: boolean;
  ownerEmail?: string;
  planType?: TenantPlanType;
  orderId: string;
  paymentType: Exclude<CheckoutPaymentType, "period">;
}): EcpayFormPayload {
  const listAmount = Math.max(1, Math.round(input.amount));
  const amount = applyFoundingDiscount(
    listAmount,
    Boolean(input.isFoundingMember),
  );
  const itemName = `拓脈 ${input.planName}`.slice(0, 200);
  const choosePayment =
    input.paymentType === "atm"
      ? "ATM"
      : input.paymentType === "cvs"
        ? "CVS"
        : "Credit";

  const params: Record<string, string> = {
    MerchantID: merchantId(),
    MerchantTradeNo: input.orderId,
    MerchantTradeDate: formatTradeDate(new Date()),
    PaymentType: "aio",
    TotalAmount: String(amount),
    TradeDesc: `Nova Crest Pulse - ${input.planName}`.slice(0, 200),
    ItemName: itemName,
    ReturnURL: webhookUrl(),
    OrderResultURL: clientReturnUrl(input.storeId),
    ClientBackURL: clientReturnUrl(input.storeId),
    ChoosePayment: choosePayment,
    EncryptType: "1",
    CustomField1: input.storeId,
    CustomField2: input.planType || "self-serve",
    CustomField3: input.ownerEmail || "",
    CustomField4: input.isFoundingMember ? "founding" : "standard",
  };

  // ATM／超商：取號結果通知（繳費代碼／虛擬帳號）
  if (choosePayment === "ATM" || choosePayment === "CVS") {
    params.PaymentInfoURL = paymentInfoUrl();
    if (choosePayment === "ATM") {
      params.ExpireDate = "3"; // 繳費期限天數
    }
    if (choosePayment === "CVS") {
      params.StoreExpireDate = "10080"; // 分鐘，約 7 天
    }
  }

  params.CheckMacValue = buildCheckMacValue(params);

  return {
    action: aioActionUrl(),
    params,
    amount,
    listAmount,
    discounted: Boolean(input.isFoundingMember),
    mode: ecpayMode(),
    paymentType: input.paymentType,
    orderId: input.orderId,
    planName: input.planName,
    storeId: input.storeId,
  };
}

/**
 * 訂閱結帳：依 paymentType 組裝綠界定期定額或 AioCheckOut。
 * 傳入的 amount 為折扣前牌價；函式內會套創始 8 折。
 * 若已自行算好應付額，請設 isFoundingMember=false 並傳最終金額。
 */
export function buildDynamicCheckoutPayload(
  input: DynamicCheckoutInput,
): EcpayFormPayload {
  const orderId = input.orderId || createTradeNo(input.storeId);
  const paymentType = normalizeCheckoutPaymentType(input.paymentType);
  if (paymentType === "period") {
    return buildPeriodOrderPayload({
      storeId: input.storeId,
      planType: input.planType,
      planName: input.planName,
      amount: input.amount,
      isFoundingMember: input.isFoundingMember,
      ownerEmail: input.ownerEmail,
      merchantMemberId:
        input.merchantMemberId || createMerchantMemberId(input.storeId),
      orderId,
    });
  }
  const aioType =
    paymentType === "atm" || paymentType === "cvs" ? paymentType : "credit";
  return buildAioCheckoutPayload({
    storeId: input.storeId,
    planName: input.planName,
    amount: input.amount,
    isFoundingMember: input.isFoundingMember,
    ownerEmail: input.ownerEmail,
    planType: input.planType,
    orderId,
    paymentType: aioType,
  });
}

/** 預約訂金：綠界 AioCheckOut（Credit；商戶開通時顧客可選 LINE Pay 等） */
export function buildBookingDepositCheckoutPayload(input: {
  storeSlug: string;
  bookingId: string;
  tradeNo: string;
  amount: number;
  itemName: string;
  customerEmail?: string;
  /** ALL＝顧客可選信用卡／LINE Pay 等；Credit＝僅信用卡 */
  choosePayment?: "ALL" | "Credit";
}) {
  const amount = Math.max(1, Math.round(input.amount));
  const choosePayment = input.choosePayment || "ALL";
  const params: Record<string, string> = {
    MerchantID: merchantId(),
    MerchantTradeNo: input.tradeNo,
    MerchantTradeDate: formatTradeDate(new Date()),
    PaymentType: "aio",
    TotalAmount: String(amount),
    TradeDesc: `拓脈預約訂金 ${input.storeSlug}`.slice(0, 200),
    ItemName: input.itemName.slice(0, 200),
    ReturnURL: `${siteBaseUrl()}/api/webhooks/ecpay`,
    OrderResultURL: `${siteBaseUrl()}/stores/${encodeURIComponent(input.storeSlug)}?booking=${encodeURIComponent(input.bookingId)}&deposit=1`,
    ChoosePayment: choosePayment,
    EncryptType: "1",
    CustomField1: input.storeSlug,
    CustomField2: "booking_deposit",
    CustomField3: input.bookingId,
    CustomField4: input.customerEmail || "",
  };
  params.CheckMacValue = buildCheckMacValue(params);
  return {
    action:
      process.env.ECPAY_AIO_ACTION_URL?.trim() ||
      "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5",
    params,
    amount,
    mode: ecpayMode(),
    bookingId: input.bookingId,
    tradeNo: input.tradeNo,
    storeSlug: input.storeSlug,
    paymentType: "ecpay" as const,
  };
}

/** 網拍訂單：綠界 AioCheckOut（僅 Credit／ATM） */
export function buildShopOrderCheckoutPayload(input: {
  storeSlug: string;
  orderId: string;
  tradeNo: string;
  amount: number;
  itemName: string;
  payment: "credit" | "atm";
  customerEmail?: string;
}) {
  const amount = Math.max(1, Math.round(input.amount));
  const choosePayment = input.payment === "atm" ? "ATM" : "Credit";
  const params: Record<string, string> = {
    MerchantID: merchantId(),
    MerchantTradeNo: input.tradeNo,
    MerchantTradeDate: formatTradeDate(new Date()),
    PaymentType: "aio",
    TotalAmount: String(amount),
    TradeDesc: `Pulse Shop ${input.storeSlug}`.slice(0, 200),
    ItemName: input.itemName.slice(0, 200),
    ReturnURL: `${siteBaseUrl()}/api/webhooks/ecpay`,
    OrderResultURL: `${siteBaseUrl()}/stores/${encodeURIComponent(input.storeSlug)}?order=${encodeURIComponent(input.orderId)}&paid=1`,
    ChoosePayment: choosePayment,
    EncryptType: "1",
    CustomField1: input.storeSlug,
    CustomField2: "shop",
    CustomField3: input.orderId,
    CustomField4: input.customerEmail || "",
  };
  if (choosePayment === "ATM") {
    params.PaymentInfoURL = paymentInfoUrl();
    params.ExpireDate = "3";
  }
  params.CheckMacValue = buildCheckMacValue(params);
  return {
    action:
      process.env.ECPAY_AIO_ACTION_URL?.trim() ||
      "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5",
    params,
    amount,
    mode: ecpayMode(),
    orderId: input.orderId,
    tradeNo: input.tradeNo,
    storeSlug: input.storeSlug,
    paymentType: input.payment,
  };
}

function periodActionUrl() {
  return (
    process.env.ECPAY_PERIOD_ACTION_API_URL?.trim() ||
    (process.env.ECPAY_STAGE === "true"
      ? "https://payment-stage.ecpay.com.tw/Cashier/CreditCardPeriodAction"
      : "https://payment.ecpay.com.tw/Cashier/CreditCardPeriodAction")
  );
}

function parseEcpayKeyValue(text: string): Record<string, string> {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  if (!trimmed) return {};
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(json)) {
        if (value === undefined || value === null) continue;
        out[key] = String(value);
      }
      return out;
    } catch {
      // fall through
    }
  }
  // 綠界偶發以 "&Key=Value&..." 開頭
  const normalized = trimmed.startsWith("&") ? trimmed.slice(1) : trimmed;
  const params = new URLSearchParams(normalized);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key) out[key] = value;
  });
  // 後備：正則擷取 RtnCode／RtnMsg
  if (!out.RtnCode) {
    const code = /RtnCode=([^&]*)/i.exec(trimmed)?.[1];
    if (code) out.RtnCode = decodeURIComponent(code);
  }
  if (!out.RtnMsg) {
    const msg = /RtnMsg=([^&]*)/i.exec(trimmed)?.[1];
    if (msg) out.RtnMsg = decodeURIComponent(msg);
  }
  return out;
}

/**
 * 綠界：停用信用卡定期定額後續扣款（CreditCardPeriodAction / Action=Cancel）
 * 成功後不可重新啟用，需另開新定期定額訂單。
 */
export async function cancelEcpayPeriodOrder(merchantTradeNo: string): Promise<{
  ok: boolean;
  mode: "live" | "mock";
  rtnCode?: string;
  rtnMsg?: string;
  raw?: string;
  skipped?: boolean;
  error?: string;
}> {
  const tradeNo = merchantTradeNo.trim();
  if (!tradeNo) {
    return { ok: false, mode: ecpayMode(), error: "缺少 MerchantTradeNo" };
  }

  if (ecpayMode() === "mock") {
    return {
      ok: true,
      mode: "mock",
      rtnCode: "1",
      rtnMsg: "Mock Cancel OK",
      skipped: false,
    };
  }

  const params: Record<string, string> = {
    MerchantID: merchantId(),
    MerchantTradeNo: tradeNo.slice(0, 20),
    Action: "Cancel",
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = buildCheckMacValue(params);

  try {
    const res = await fetch(periodActionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams(params).toString(),
    });
    const raw = await res.text();
    const parsed = parseEcpayKeyValue(raw);
    const rtnCode = parsed.RtnCode || parsed.rtnCode || "";
    const rtnMsg = parsed.RtnMsg || parsed.rtnMsg || raw.slice(0, 200);
    // 1=成功；90100149=訂單已停用（視為已取消成功）
    const ok = rtnCode === "1" || rtnCode === "90100149";
    return {
      ok,
      mode: "live",
      rtnCode,
      rtnMsg,
      raw: raw.slice(0, 500),
      error: ok ? undefined : rtnMsg || `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      error: error instanceof Error ? error.message : "綠界取消定期定額失敗",
    };
  }
}

/** B2C＝大宗寄倉；C2C＝店到店。需與綠界後台申請的物流模式一致 */
export type EcpayLogisticsMode = "B2C" | "C2C";

export function ecpayLogisticsMode(): EcpayLogisticsMode {
  const raw = (process.env.ECPAY_LOGISTICS_MODE || "C2C").trim().toUpperCase();
  return raw === "B2C" ? "B2C" : "C2C";
}

export function resolveLogisticsSubType(
  pickup: "711" | "family",
  mode: EcpayLogisticsMode = ecpayLogisticsMode(),
) {
  if (pickup === "family") {
    return mode === "B2C" ? ("FAMI" as const) : ("FAMIC2C" as const);
  }
  return mode === "B2C" ? ("UNIMART" as const) : ("UNIMARTC2C" as const);
}

function logisticsMapActionUrl() {
  if (process.env.ECPAY_LOGISTICS_MAP_URL?.trim()) {
    return process.env.ECPAY_LOGISTICS_MAP_URL.trim();
  }
  if (process.env.ECPAY_STAGE === "true") {
    return "https://logistics-stage.ecpay.com.tw/Express/map";
  }
  return "https://logistics.ecpay.com.tw/Express/map";
}

/**
 * 綠界物流 CheckMac：物流文件範例為 MD5；若設 ECPAY_LOGISTICS_MAC=sha256 則改 SHA256
 */
export function buildLogisticsCheckMacValue(params: Record<string, string>) {
  const algo =
    (process.env.ECPAY_LOGISTICS_MAC || "md5").trim().toLowerCase() ===
    "sha256"
      ? "sha256"
      : "md5";
  const sorted = Object.keys(params)
    .filter(
      (key) =>
        key !== "CheckMacValue" &&
        params[key] !== undefined &&
        params[key] !== null &&
        String(params[key]) !== "",
    )
    .sort((a, b) => (a > b ? 1 : -1))
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const raw = `HashKey=${hashKey()}&${sorted}&HashIV=${hashIv()}`;
  // 綠界物流 CheckMac 依 PHP urlencode：空白為 +（非 %20）
  let encoded = encodeURIComponent(raw).toLowerCase();
  encoded = encoded
    .replace(/%20/g, "+")
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");

  return createHash(algo).update(encoded).digest("hex").toUpperCase();
}

/** 綠界物流電子地圖（超商選店）；貨到付款須 IsCollection=Y */
export function buildLogisticsMapPayload(input: {
  storeSlug: string;
  pickup: "711" | "family";
  logistics?: string;
  extraData?: string;
  device?: "0" | "1";
  /** true＝超商取貨付款（代收），地圖門市需支援代收 */
  isCollection?: boolean;
}) {
  const logistics =
    input.logistics || resolveLogisticsSubType(input.pickup);
  const params: Record<string, string> = {
    MerchantID: merchantId(),
    MerchantTradeNo: `MAP${Date.now().toString().slice(-12)}`.slice(0, 20),
    LogisticsType: "CVS",
    LogisticsSubType: logistics,
    IsCollection: input.isCollection ? "Y" : "N",
    ServerReplyURL: `${siteBaseUrl()}/api/logistics/emap/callback`,
    ExtraData: (input.extraData || input.storeSlug).slice(0, 20),
    Device: input.device || "0",
  };
  if (ecpayConfigured()) {
    params.CheckMacValue = buildLogisticsCheckMacValue(params);
  }
  return {
    action: logisticsMapActionUrl(),
    params,
    mode: ecpayMode(),
    logisticsMode: ecpayLogisticsMode(),
    logisticsSubType: logistics,
  };
}

/**
 * 向綠界預檢電子地圖是否可用（未開通物流會回「找不到加密金鑰」）
 */
export async function probeLogisticsMapAvailability(input: {
  storeSlug: string;
  pickup: "711" | "family";
  isCollection?: boolean;
}) {
  if (ecpayMode() === "mock") {
    return {
      ok: true as const,
      mode: "mock" as const,
      allowManual: true,
      message: "示範模式：請改用手動輸入門市",
    };
  }

  const payload = buildLogisticsMapPayload(input);
  try {
    const res = await fetch(payload.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams(payload.params).toString(),
    });
    const text = await res.text();
    if (text.includes("找不到加密金鑰") || text.includes("未申請開通")) {
      return {
        ok: false as const,
        mode: "live" as const,
        allowManual: true,
        code: "LOGISTICS_NOT_ENABLED" as const,
        message:
          "此綠界商家尚未開通超商物流（7-11／全家）。請至綠界後台申請物流，或先手動輸入取貨門市。",
        raw: text.slice(0, 200),
        logisticsSubType: payload.logisticsSubType,
        logisticsMode: payload.logisticsMode,
      };
    }
    if (
      text.includes("檢查碼") ||
      text.includes("CheckMac") ||
      text.includes("CheckMacValue")
    ) {
      return {
        ok: false as const,
        mode: "live" as const,
        allowManual: true,
        code: "CHECKMAC" as const,
        message: "綠界電子地圖檢查碼驗證失敗，請確認物流 Hash 設定或改手動選店。",
        raw: text.slice(0, 200),
        logisticsSubType: payload.logisticsSubType,
        logisticsMode: payload.logisticsMode,
      };
    }
    // 成功時綠界通常回傳地圖 HTML
    return {
      ok: true as const,
      mode: "live" as const,
      allowManual: false,
      message: "電子地圖可用",
      logisticsSubType: payload.logisticsSubType,
      logisticsMode: payload.logisticsMode,
    };
  } catch (error) {
    return {
      ok: false as const,
      mode: "live" as const,
      allowManual: true,
      code: "NETWORK" as const,
      message:
        error instanceof Error
          ? error.message
          : "無法連線綠界電子地圖，請改手動輸入門市",
    };
  }
}

function logisticsBaseUrl() {
  if (process.env.ECPAY_STAGE === "true") {
    return "https://logistics-stage.ecpay.com.tw";
  }
  return "https://logistics.ecpay.com.tw";
}

function logisticsCreateUrl() {
  return (
    process.env.ECPAY_LOGISTICS_CREATE_URL?.trim() ||
    `${logisticsBaseUrl()}/Express/Create`
  );
}

function logisticsPrintHelperUrl() {
  return `${logisticsBaseUrl()}/helper/printTradeDocument`;
}

/** 綠界姓名規則：中文約 2～5 字、英文 4～10；去掉數字與特殊符號 */
export function sanitizeEcpayPersonName(raw: string, fallback: string) {
  const cleaned = raw
    .trim()
    .replace(/[0-9０-９]/g, "")
    .replace(/[^\u4e00-\u9fffA-Za-z\s]/g, "")
    .replace(/\s+/g, "");
  const hasCjk = /[\u4e00-\u9fff]/.test(cleaned);
  if (hasCjk) {
    const cjk = cleaned.replace(/[A-Za-z]/g, "").slice(0, 5);
    if (cjk.length >= 2) return cjk;
  } else if (cleaned.length >= 4) {
    return cleaned.slice(0, 10);
  }
  const fb = fallback
    .trim()
    .replace(/[0-9０-９]/g, "")
    .replace(/[^\u4e00-\u9fffA-Za-z]/g, "");
  if (/[\u4e00-\u9fff]/.test(fb) && fb.length >= 2) return fb.slice(0, 5);
  if (fb.length >= 4) return fb.slice(0, 10);
  return "買家友人";
}

function sanitizeGoodsName(raw: string) {
  return raw
    .replace(/[\^'`!@#%&*+\\"<>|[\]_]/g, "")
    .trim()
    .slice(0, 50) || "商品";
}

function formatMerchantTradeDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function verifyLogisticsCheckMacValue(params: Record<string, string>) {
  const incoming = params.CheckMacValue?.toUpperCase();
  if (!incoming) return false;
  const rest = { ...params };
  delete rest.CheckMacValue;
  return buildLogisticsCheckMacValue(rest) === incoming;
}

export type CreateCvsLogisticsInput = {
  merchantTradeNo: string;
  pickup: "711" | "family";
  goodsAmount: number;
  goodsName: string;
  isCollection: boolean;
  senderName: string;
  senderCellPhone: string;
  receiverName: string;
  receiverCellPhone: string;
  receiverEmail?: string;
  receiverStoreId: string;
  remark?: string;
};

export type CreateCvsLogisticsResult =
  | {
      ok: true;
      mode: "live" | "mock";
      logisticsId: string;
      merchantTradeNo: string;
      logisticsSubType: string;
      cvsPaymentNo?: string;
      cvsValidationNo?: string;
      rtnCode: string;
      rtnMsg: string;
      raw: string;
    }
  | { ok: false; mode: "live" | "mock"; error: string; raw?: string };

function parseLogisticsCreateBody(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false as const, error: "綠界無回應" };
  }
  if (trimmed.startsWith("0|") || trimmed.startsWith("0｜")) {
    const msg = trimmed.replace(/^0[|｜]/, "").slice(0, 300) || "建立物流失敗";
    let friendly = msg;
    if (msg.includes("餘額")) {
      friendly = `${msg}（請至綠界廠商後台為物流帳戶儲值／確認可提領餘額後再試）`;
    } else if (msg.includes("門市不存在") || msg.includes("門市店號")) {
      friendly = `${msg}。請請買家重新以綠界電子地圖選擇真實門市後再下單；測試用假門市代號無法建立出貨單。`;
    }
    return {
      ok: false as const,
      error: friendly,
    };
  }

  let body = trimmed;
  if (body.startsWith("1|") || body.startsWith("1｜")) {
    body = body.slice(2);
  }
  if (body.startsWith("OK|") || body.startsWith("OK｜")) {
    body = body.slice(3);
  }
  // 支援 key=value&… 或以 | 分隔
  const normalized = body.includes("=")
    ? body.replace(/\|/g, "&")
    : body;
  const params: Record<string, string> = {};
  for (const part of normalized.split("&")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = decodeURIComponent(part.slice(0, eq).trim());
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    if (key) params[key] = value;
  }
  return { ok: true as const, params };
}

/** 幕後建立超商物流訂單（含貨到付款代收） */
export async function createCvsLogisticsOrder(
  input: CreateCvsLogisticsInput,
): Promise<CreateCvsLogisticsResult> {
  const pickup = input.pickup;
  const logisticsSubType = resolveLogisticsSubType(pickup);
  const senderCell = normalizeTaiwanMobile(input.senderCellPhone);
  const receiverCell = normalizeTaiwanMobile(input.receiverCellPhone);
  if (!isValidTaiwanMobile(senderCell)) {
    return {
      ok: false,
      mode: ecpayMode(),
      error: "寄件人手機無效，請於店家設定填寫 09 開頭手機",
    };
  }
  if (!isValidTaiwanMobile(receiverCell)) {
    return {
      ok: false,
      mode: ecpayMode(),
      error: "收件人手機無效",
    };
  }
  const storeId = (input.receiverStoreId || "").trim();
  if (storeId.length < 3) {
    return { ok: false, mode: ecpayMode(), error: "缺少收件門市代號" };
  }

  const goodsAmount = Math.max(1, Math.min(20000, Math.round(input.goodsAmount)));
  const isCollection = input.isCollection;
  const senderName = sanitizeEcpayPersonName(input.senderName, "賣家");
  const receiverName = sanitizeEcpayPersonName(input.receiverName, "買家");
  const goodsName = sanitizeGoodsName(input.goodsName);
  const merchantTradeNo = input.merchantTradeNo.slice(0, 20);

  if (ecpayMode() === "mock") {
    const mockPay = `MOCK${Date.now().toString().slice(-8)}`;
    return {
      ok: true,
      mode: "mock",
      logisticsId: `MOCKLG${Date.now().toString().slice(-10)}`,
      merchantTradeNo,
      logisticsSubType,
      cvsPaymentNo: mockPay,
      cvsValidationNo: "0000",
      rtnCode: "300",
      rtnMsg: "示範模式：已建立模擬物流單",
      raw: "mock",
    };
  }

  const params: Record<string, string> = {
    MerchantID: merchantId(),
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: formatMerchantTradeDate(),
    LogisticsType: "CVS",
    LogisticsSubType: logisticsSubType,
    GoodsAmount: String(goodsAmount),
    GoodsName: goodsName,
    SenderName: senderName,
    SenderCellPhone: senderCell,
    ReceiverName: receiverName,
    ReceiverCellPhone: receiverCell,
    ServerReplyURL: `${siteBaseUrl()}/api/webhooks/ecpay/logistics`,
    ReceiverStoreID: storeId,
    IsCollection: isCollection ? "Y" : "N",
  };
  if (isCollection) {
    params.CollectionAmount = String(goodsAmount);
  }
  if (input.receiverEmail?.trim()) {
    params.ReceiverEmail = input.receiverEmail.trim().slice(0, 50);
  }
  if (input.remark?.trim()) {
    params.Remark = input.remark.trim().slice(0, 200);
  }
  params.CheckMacValue = buildLogisticsCheckMacValue(params);

  try {
    const res = await fetch(logisticsCreateUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "text/html",
      },
      body: new URLSearchParams(params).toString(),
    });
    const raw = await res.text();
    const parsed = parseLogisticsCreateBody(raw);
    if (!parsed.ok) {
      return { ok: false, mode: "live", error: parsed.error, raw: raw.slice(0, 400) };
    }
    const p = parsed.params;
    const rtnCode = p.RtnCode || "";
    const logisticsId = p.AllPayLogisticsID || "";
    // 300＝建立成功；部分環境可能回其他成功碼但有 LogisticsID
    if (!logisticsId) {
      return {
        ok: false,
        mode: "live",
        error: p.RtnMsg || `建立物流失敗（RtnCode=${rtnCode || "?"}）`,
        raw: raw.slice(0, 400),
      };
    }
    if (rtnCode && rtnCode !== "300" && rtnCode !== "310") {
      // 仍有 LogisticsID 時視為可用，僅附訊息
    }
    return {
      ok: true,
      mode: "live",
      logisticsId,
      merchantTradeNo: p.MerchantTradeNo || merchantTradeNo,
      logisticsSubType,
      cvsPaymentNo: p.CVSPaymentNo || undefined,
      cvsValidationNo: p.CVSValidationNo || undefined,
      rtnCode: rtnCode || "300",
      rtnMsg: p.RtnMsg || "OK",
      raw: raw.slice(0, 400),
    };
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      error:
        error instanceof Error ? error.message : "無法連線綠界物流建立訂單",
    };
  }
}

/** 產生列印託運單表單（前端 POST 開新視窗） */
export function buildLogisticsPrintPayload(input: {
  logisticsId: string;
  logisticsSubType: string;
  cvsPaymentNo?: string | null;
  cvsValidationNo?: string | null;
}) {
  const sub = input.logisticsSubType;
  const base = logisticsBaseUrl();

  if (ecpayMode() === "mock") {
    return {
      mode: "mock" as const,
      action: `${siteBaseUrl()}/api/shop/logistics/mock-label`,
      params: {
        logisticsId: input.logisticsId,
        logisticsSubType: sub,
        cvsPaymentNo: input.cvsPaymentNo || "",
        cvsValidationNo: input.cvsValidationNo || "",
      },
    };
  }

  // C2C：各超商專用列印 API（需交貨便代碼）
  if (sub === "UNIMARTC2C") {
    const params: Record<string, string> = {
      MerchantID: merchantId(),
      AllPayLogisticsID: input.logisticsId,
      CVSPaymentNo: input.cvsPaymentNo || "",
      CVSValidationNo: input.cvsValidationNo || "",
    };
    params.CheckMacValue = buildLogisticsCheckMacValue(params);
    return {
      mode: "live" as const,
      action: `${base}/Express/PrintUniMartC2COrderInfo`,
      params,
    };
  }
  if (sub === "FAMIC2C") {
    const params: Record<string, string> = {
      MerchantID: merchantId(),
      AllPayLogisticsID: input.logisticsId,
      CVSPaymentNo: input.cvsPaymentNo || "",
      CVSValidationNo: input.cvsValidationNo || "",
    };
    params.CheckMacValue = buildLogisticsCheckMacValue(params);
    return {
      mode: "live" as const,
      action: `${base}/Express/PrintFAMIC2COrderInfo`,
      params,
    };
  }

  // B2C／其餘：通用 helper 列印
  const params: Record<string, string> = {
    MerchantID: merchantId(),
    AllPayLogisticsID: input.logisticsId,
  };
  params.CheckMacValue = buildLogisticsCheckMacValue(params);
  return {
    mode: "live" as const,
    action: logisticsPrintHelperUrl(),
    params,
  };
}
