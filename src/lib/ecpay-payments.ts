/**
 * 綠界已開通、前台可展示的付款方式（逗號分隔）。
 * 網拍：NEXT_PUBLIC_ECPAY_SHOP_PAYMENTS（例：cod 或 cod,atm,credit）
 * 訂閱：NEXT_PUBLIC_ECPAY_BILLING_PAYMENTS（例：period,credit,atm,cvs；空白＝暫不開放線上付）
 *
 * 未設定網拍變數時預設僅 cod，避免買家被導到綠界「未開通付款方式」錯誤頁。
 */

export type ShopPaymentId = "cod" | "atm" | "credit";
export type BillingPaymentId = "period" | "credit" | "atm" | "cvs";

const SHOP_ALL: ShopPaymentId[] = ["cod", "atm", "credit"];
/** 顯示順序：一次付清優先，定期定額需特店加開 */
const BILLING_ALL: BillingPaymentId[] = ["credit", "atm", "cvs", "period"];

function parseList(raw: string | undefined): string[] {
  return (raw || "")
    .split(/[,|\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function enabledShopPayments(): ShopPaymentId[] {
  const raw =
    process.env.NEXT_PUBLIC_ECPAY_SHOP_PAYMENTS ??
    process.env.ECPAY_SHOP_PAYMENTS;
  if (raw == null) return ["cod"];
  const list = parseList(raw);
  if (list.length === 0) return ["cod"];
  return SHOP_ALL.filter((id) => list.includes(id));
}

export function isShopPaymentEnabled(payment: string) {
  return enabledShopPayments().includes(payment as ShopPaymentId);
}

export function enabledBillingPayments(): BillingPaymentId[] {
  const raw =
    process.env.NEXT_PUBLIC_ECPAY_BILLING_PAYMENTS ??
    process.env.ECPAY_BILLING_PAYMENTS;
  // 未設定時維持顯示全部；none／off／空白＝全部關閉（仍可走免費試用）
  if (raw == null) return [...BILLING_ALL];
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "none" || trimmed === "off") return [];
  const list = parseList(raw);
  return BILLING_ALL.filter((id) => list.includes(id));
}

export function shopPaymentsUnavailableMessage() {
  return "目前僅開放「超商取貨付款」。請改選 7-11 或全家取貨後再結帳。";
}
