/**
 * 預約訂金設定（顧客預約金流，與平台訂閱 bank_transfer 無關）
 *
 * 可用：
 * - none：免訂金／現場結帳
 * - bank_transfer：手動匯款訂金（後五碼）
 *
 * 預留（暫不開放）：
 * - ecpay：綠界／LINE Pay 線上預付訂金
 * - deposit_enabled / ecpay_merchant_id / hash_key / hash_iv
 */

/** 綠界預付訂金模組總開關：false＝審核中，禁止啟用與前台觸發 */
export const ECPAY_DEPOSIT_MODULE_ENABLED = false;

export type DepositPaymentMode = "none" | "bank_transfer" | "ecpay";

export type DepositAmountType = "fixed" | "percent";

/**
 * 賣家訂金／綠界金流設定（Stores 擴充欄位對應）
 * camelCase 為應用層；snake_case 見 DepositStoreRow
 */
export type DepositSettings = {
  /**
   * 綠界預付訂金是否啟用（deposit_enabled）
   * 模組審核中時強制 false
   */
  depositEnabled: boolean;
  /**
   * 預留訂金金額（deposit_amount）；與 fixedAmount 同步維護
   */
  depositAmount: number;
  /** 綠界特店編號（ecpay_merchant_id） */
  ecpayMerchantId: string | null;
  /** 綠界 HashKey（ecpay_hash_key） */
  ecpayHashKey: string | null;
  /** 綠界 HashIV（ecpay_hash_iv） */
  ecpayHashIv: string | null;

  /** 實際可選金流：none／bank_transfer；ecpay 僅預留 */
  mode: DepositPaymentMode;
  amountType: DepositAmountType;
  /** 固定訂金金額（元） */
  fixedAmount: number;
  /** 依服務金額百分比（1–100） */
  percent: number;
  /** 匯款說明（帳戶後五碼對帳提示） */
  bankHint?: string;
  /** 最低訂金（百分比模式時套用） */
  minAmount?: number;
};

/** Stores Table 對應（snake_case 預留欄位） */
export type DepositStoreRow = {
  deposit_enabled: boolean;
  deposit_amount: number;
  ecpay_merchant_id: string | null;
  ecpay_hash_key: string | null;
  ecpay_hash_iv: string | null;
};

export const DEPOSIT_MODE_LABELS: Record<DepositPaymentMode, string> = {
  none: "免訂金（現場結帳）",
  bank_transfer: "手動銀行轉帳（填寫後五碼）",
  ecpay: "綠界 (ECPay) / LINE Pay 預付訂金",
};

export function defaultDepositSettings(): DepositSettings {
  return {
    depositEnabled: false,
    depositAmount: 0,
    ecpayMerchantId: null,
    ecpayHashKey: null,
    ecpayHashIv: null,
    mode: "none",
    amountType: "fixed",
    fixedAmount: 0,
    percent: 30,
    bankHint: "請匯入店家指定帳戶後，於預約頁回填匯款後五碼。",
    minAmount: 100,
  };
}

function nullishString(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s ? s.slice(0, 120) : null;
}

/**
 * 正規化並強制關閉綠界預付模組（Coming Soon）
 * - deposit_enabled 永遠 false（模組未開放時）
 * - mode=ecpay 降級為 none
 */
export function normalizeDepositSettings(
  raw?: Partial<DepositSettings> | null,
): DepositSettings {
  const base = defaultDepositSettings();
  if (!raw) return base;

  let mode: DepositPaymentMode =
    raw.mode === "bank_transfer"
      ? "bank_transfer"
      : raw.mode === "ecpay"
        ? "ecpay"
        : "none";

  // 模組未開放：禁止 ecpay 生效
  if (!ECPAY_DEPOSIT_MODULE_ENABLED && mode === "ecpay") {
    mode = "none";
  }

  const amountType: DepositAmountType =
    raw.amountType === "percent" ? "percent" : "fixed";

  const fixedAmount = Math.max(
    0,
    Math.min(
      100_000,
      Math.round(
        Number(
          raw.fixedAmount ??
            raw.depositAmount ??
            base.fixedAmount,
        ) || 0,
      ),
    ),
  );

  const depositEnabled = ECPAY_DEPOSIT_MODULE_ENABLED
    ? Boolean(raw.depositEnabled)
    : false;

  return {
    depositEnabled,
    depositAmount: fixedAmount,
    ecpayMerchantId: nullishString(raw.ecpayMerchantId),
    ecpayHashKey: nullishString(raw.ecpayHashKey),
    ecpayHashIv: nullishString(raw.ecpayHashIv),
    mode,
    amountType,
    fixedAmount,
    percent: Math.max(
      1,
      Math.min(100, Math.round(Number(raw.percent) || base.percent)),
    ),
    bankHint: String(raw.bankHint || base.bankHint || "").slice(0, 400),
    minAmount: Math.max(
      0,
      Math.min(50_000, Math.round(Number(raw.minAmount) || base.minAmount || 0)),
    ),
  };
}

/** 寫入／報表用 snake_case 列 */
export function toDepositStoreRow(
  settings: DepositSettings | null | undefined,
): DepositStoreRow {
  const s = normalizeDepositSettings(settings);
  return {
    deposit_enabled: s.depositEnabled,
    deposit_amount: s.depositAmount,
    ecpay_merchant_id: s.ecpayMerchantId,
    ecpay_hash_key: s.ecpayHashKey,
    ecpay_hash_iv: s.ecpayHashIv,
  };
}

export function fromDepositStoreRow(
  row?: Partial<DepositStoreRow> | null,
  rest?: Partial<DepositSettings> | null,
): DepositSettings {
  return normalizeDepositSettings({
    ...rest,
    depositEnabled: Boolean(row?.deposit_enabled),
    depositAmount: Number(row?.deposit_amount) || 0,
    fixedAmount: Number(row?.deposit_amount) || Number(rest?.fixedAmount) || 0,
    ecpayMerchantId: row?.ecpay_merchant_id ?? null,
    ecpayHashKey: row?.ecpay_hash_key ?? null,
    ecpayHashIv: row?.ecpay_hash_iv ?? null,
  });
}

/** 綠界線上訂金是否實際可用（模組＋開關＋憑證） */
export function isEcpayDepositLive(
  settings: DepositSettings | null | undefined,
): boolean {
  if (!ECPAY_DEPOSIT_MODULE_ENABLED) return false;
  const s = normalizeDepositSettings(settings);
  return (
    s.depositEnabled &&
    s.mode === "ecpay" &&
    Boolean(s.ecpayMerchantId && s.ecpayHashKey && s.ecpayHashIv)
  );
}

/** 依服務應付金額計算訂金；mode=none 或綠界未開放時回傳 0（bank_transfer 仍計） */
export function computeDepositAmount(
  settings: DepositSettings | null | undefined,
  payAmount: number,
): number {
  const s = normalizeDepositSettings(settings);
  if (s.mode === "none") return 0;
  if (s.mode === "ecpay" && !isEcpayDepositLive(s)) return 0;
  const base = Math.max(0, Math.round(Number(payAmount) || 0));
  let amount =
    s.amountType === "percent"
      ? Math.round((base * s.percent) / 100)
      : s.fixedAmount;
  if (s.amountType === "percent" && (s.minAmount || 0) > 0) {
    amount = Math.max(amount, s.minAmount || 0);
  }
  if (base > 0) amount = Math.min(amount, base);
  return Math.max(0, amount);
}

export function depositRequiresPrepay(
  settings: DepositSettings | null | undefined,
) {
  const s = normalizeDepositSettings(settings);
  if (s.mode === "bank_transfer") return true;
  if (s.mode === "ecpay") return isEcpayDepositLive(s);
  return false;
}
