import { auth } from "@/auth";
import { isDeveloperEmail } from "@/lib/roles";
import {
  getShopOrder,
  listShopOrders,
  patchShopOrder,
} from "@/lib/shop-orders-db.server";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import type { ShopOrderStatus } from "@/lib/store-content";
import { NextResponse } from "next/server";

export const instant = false;

async function requireStoreAccess(storeSlug: string) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() || "";
  if (!email) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const tenant = await getTenantDbByStoreId(storeSlug);
  if (!tenant) {
    return { error: NextResponse.json({ error: "找不到店家" }, { status: 404 }) };
  }
  const owner = tenant.ownerEmail.trim().toLowerCase() === email;
  if (!isDeveloperEmail(email) && !owner) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { email, tenant };
}

export async function GET(request: Request) {
  const storeSlug = new URL(request.url).searchParams.get("storeSlug") || "";
  if (!storeSlug) {
    return NextResponse.json({ error: "缺少 storeSlug" }, { status: 400 });
  }
  const access = await requireStoreAccess(storeSlug);
  if ("error" in access && access.error) return access.error;

  const orders = await listShopOrders(storeSlug);
  return NextResponse.json({ ok: true, orders });
}

export async function PATCH(request: Request) {
  let body: {
    storeSlug?: string;
    orderId?: string;
    status?: ShopOrderStatus;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const storeSlug = (body.storeSlug || "").trim().toLowerCase();
  const orderId = (body.orderId || "").trim();
  if (!storeSlug || !orderId || !body.status) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }
  const access = await requireStoreAccess(storeSlug);
  if ("error" in access && access.error) return access.error;

  const existing = await getShopOrder(storeSlug, orderId);
  if (!existing) {
    return NextResponse.json({ error: "找不到訂單" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const patch: Partial<{
    status: ShopOrderStatus;
    shippedAt: string;
    completedAt: string;
    paidAt: string;
  }> = {
    status: body.status,
  };
  if (body.status === "shipped") patch.shippedAt = now;
  if (body.status === "completed") {
    patch.completedAt = now;
    // 貨到付款：完成取貨時才視為收款，寫入 paidAt 供撥款對帳
    if (existing.payment === "cod" && !existing.paidAt) {
      patch.paidAt = now;
    }
  }

  const updated = await patchShopOrder(storeSlug, orderId, patch);
  if (!updated) {
    return NextResponse.json({ error: "找不到訂單" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order: updated });
}
