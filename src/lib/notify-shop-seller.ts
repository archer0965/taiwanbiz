import { sendShopOrderSellerNotify } from "@/lib/shop-order-mail";
import type { ShopOrder } from "@/lib/store-content";
import { getStoreContent } from "@/lib/store-content-db.server";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";

/** 新訂單通知賣家；寄信失敗不阻斷下單流程 */
export async function notifyShopSellerNewOrder(order: ShopOrder) {
  try {
    const [tenant, content] = await Promise.all([
      getTenantDbByStoreId(order.storeSlug),
      getStoreContent(order.storeSlug),
    ]);
    const sellerEmail =
      tenant?.ownerEmail?.trim() ||
      content?.profile?.email?.trim() ||
      "";
    const storeName =
      content?.profile?.name?.trim() ||
      tenant?.name?.trim() ||
      order.storeSlug;

    if (!sellerEmail) {
      console.warn(
        "[notify-shop-seller] no seller email",
        order.storeSlug,
        order.id,
      );
      return { ok: false as const, reason: "no-email" };
    }

    const result = await sendShopOrderSellerNotify({
      sellerEmail,
      storeName,
      order,
    });
    return { ok: true as const, ...result, sellerEmail };
  } catch (error) {
    console.error("[notify-shop-seller]", order.id, error);
    return { ok: false as const, reason: "error" };
  }
}
