import type { ShopProduct } from "@/data/stores-db";

export type ShopCartLine = {
  key: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  size: string;
  colorId: string;
  colorName: string;
  quantity: number;
  stockStatus: ShopProduct["stockStatus"];
};

export function cartLineKey(
  productId: string,
  size: string,
  colorId: string,
) {
  return `${productId}__${size}__${colorId}`;
}

export function cartSubtotal(lines: ShopCartLine[]) {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function cartItemCount(lines: ShopCartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function upsertCartLine(
  lines: ShopCartLine[],
  next: Omit<ShopCartLine, "key" | "quantity"> & { quantity?: number },
): ShopCartLine[] {
  const key = cartLineKey(next.productId, next.size, next.colorId);
  const qty = next.quantity ?? 1;
  const existing = lines.find((line) => line.key === key);
  if (existing) {
    return lines.map((line) =>
      line.key === key
        ? { ...line, quantity: Math.min(line.quantity + qty, 20) }
        : line,
    );
  }
  return [
    ...lines,
    {
      key,
      productId: next.productId,
      name: next.name,
      price: next.price,
      image: next.image,
      size: next.size,
      colorId: next.colorId,
      colorName: next.colorName,
      quantity: Math.min(qty, 20),
      stockStatus: next.stockStatus,
    },
  ];
}

export function updateCartQuantity(
  lines: ShopCartLine[],
  key: string,
  quantity: number,
): ShopCartLine[] {
  if (quantity <= 0) return lines.filter((line) => line.key !== key);
  return lines.map((line) =>
    line.key === key
      ? { ...line, quantity: Math.min(quantity, 20) }
      : line,
  );
}

function cartStorageKey(storeSlug: string) {
  return `pulse-shop-cart:${storeSlug.trim().toLowerCase()}`;
}

function checkoutDraftKey(storeSlug: string) {
  return `pulse-shop-checkout:${storeSlug.trim().toLowerCase()}`;
}

function isCartLine(value: unknown): value is ShopCartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<ShopCartLine>;
  return Boolean(
    line.key &&
      line.productId &&
      line.name &&
      typeof line.price === "number" &&
      typeof line.quantity === "number" &&
      line.size != null &&
      line.colorId != null,
  );
}

/** 超商電子地圖會整頁跳轉，購物車需寫入 sessionStorage 以免回來後清空 */
export function loadShopCart(storeSlug: string): ShopCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(cartStorageKey(storeSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartLine).map((line) => ({
      ...line,
      quantity: Math.min(Math.max(1, Math.round(line.quantity)), 20),
      price: Math.max(0, Math.round(line.price)),
      image: line.image || "",
      colorName: line.colorName || "",
      stockStatus: line.stockStatus === "preorder" ? "preorder" : "in_stock",
    }));
  } catch {
    return [];
  }
}

export function saveShopCart(storeSlug: string, lines: ShopCartLine[]) {
  if (typeof window === "undefined") return;
  try {
    if (lines.length === 0) {
      sessionStorage.removeItem(cartStorageKey(storeSlug));
      return;
    }
    sessionStorage.setItem(cartStorageKey(storeSlug), JSON.stringify(lines));
  } catch {
    // ignore quota / private mode
  }
}

export function clearShopCart(storeSlug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(cartStorageKey(storeSlug));
  } catch {
    // ignore
  }
}

export type ShopCheckoutDraft = {
  name?: string;
  phone?: string;
  pickup?: PickupMethodId;
  note?: string;
  promoCode?: string;
  storeCode?: string;
  storeNameCvs?: string;
  storeAddrCvs?: string;
};

export function loadCheckoutDraft(storeSlug: string): ShopCheckoutDraft {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(checkoutDraftKey(storeSlug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ShopCheckoutDraft;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCheckoutDraft(
  storeSlug: string,
  draft: ShopCheckoutDraft,
) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(checkoutDraftKey(storeSlug), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function clearCheckoutDraft(storeSlug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(checkoutDraftKey(storeSlug));
  } catch {
    // ignore
  }
}

export const PICKUP_METHODS = [
  { id: "711", label: "7-11 超商取貨" },
  { id: "family", label: "全家超商取貨" },
] as const;

export const PAYMENT_METHODS = [
  { id: "cod", label: "超商取貨付款（貨到付款）" },
] as const;

export type PickupMethodId = (typeof PICKUP_METHODS)[number]["id"];
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

/** 網拍結帳目前僅開放超商取貨付款 */
export function paymentMethodsForPickup(pickup: PickupMethodId) {
  void pickup;
  return PAYMENT_METHODS.filter((m) => m.id === "cod");
}
