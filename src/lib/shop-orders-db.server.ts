import {
  computeShopFees,
  type PayoutBatch,
  type ShopOrder,
  type ShopOrderStatus,
} from "@/lib/store-content";
import { get } from "@vercel/blob";
import { put } from "@vercel/blob";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data", "orders");

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function blobPath(slug: string) {
  return `taiwanbiz/orders/${slug.trim().toLowerCase()}.json`;
}

function diskPath(slug: string) {
  return path.join(DATA_DIR, `${slug.trim().toLowerCase()}.json`);
}

function ensureDir() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

type OrdersFile = {
  storeSlug: string;
  orders: ShopOrder[];
  payouts: PayoutBatch[];
};

type GlobalOrders = {
  __taiwanbizOrders?: Map<string, OrdersFile>;
  __taiwanbizOrdersWrite?: Map<string, Promise<void>>;
};

function g() {
  return globalThis as typeof globalThis & GlobalOrders;
}

function cache() {
  const store = g();
  if (!store.__taiwanbizOrders) store.__taiwanbizOrders = new Map();
  return store.__taiwanbizOrders;
}

function chains() {
  const store = g();
  if (!store.__taiwanbizOrdersWrite) store.__taiwanbizOrdersWrite = new Map();
  return store.__taiwanbizOrdersWrite;
}

function emptyFile(slug: string): OrdersFile {
  return { storeSlug: slug, orders: [], payouts: [] };
}

async function readBlob(slug: string): Promise<OrdersFile | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(blobPath(slug), {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const parsed = JSON.parse(
      await new Response(result.stream).text(),
    ) as OrdersFile;
    if (!parsed?.storeSlug) return null;
    return {
      storeSlug: parsed.storeSlug,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
    };
  } catch {
    return null;
  }
}

function readDisk(slug: string): OrdersFile | null {
  try {
    const file = diskPath(slug);
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as OrdersFile;
    return {
      storeSlug: parsed.storeSlug || slug,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
    };
  } catch {
    return null;
  }
}

function mergeOrdersById(base: ShopOrder[], incoming: ShopOrder[]) {
  const map = new Map<string, ShopOrder>();
  for (const order of base) map.set(order.id, order);
  for (const order of incoming) {
    const prev = map.get(order.id);
    if (!prev || (order.updatedAt || "") >= (prev.updatedAt || "")) {
      map.set(order.id, order);
    }
  }
  return [...map.values()].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

function mergePayoutsById(base: PayoutBatch[], incoming: PayoutBatch[]) {
  const map = new Map<string, PayoutBatch>();
  for (const row of base) map.set(row.id, row);
  for (const row of incoming) map.set(row.id, row);
  return [...map.values()];
}

async function persist(file: OrdersFile) {
  let next: OrdersFile = {
    storeSlug: file.storeSlug.trim().toLowerCase(),
    orders: [...file.orders],
    payouts: [...file.payouts],
  };

  // 寫入前再讀一次 Blob 合併，避免不同 instance 互相覆蓋訂單
  if (blobConfigured()) {
    const latest = await readBlob(next.storeSlug);
    if (latest) {
      next = {
        storeSlug: next.storeSlug,
        orders: mergeOrdersById(latest.orders, next.orders),
        payouts: mergePayoutsById(latest.payouts, next.payouts),
      };
    }
  }

  cache().set(next.storeSlug, next);
  try {
    ensureDir();
    writeFileSync(diskPath(next.storeSlug), JSON.stringify(next, null, 2), "utf8");
  } catch {
    // ignore
  }
  const map = chains();
  const prev = map.get(next.storeSlug) ?? Promise.resolve();
  const job = prev
    .catch(() => undefined)
    .then(async () => {
      if (!blobConfigured()) return;
      await put(blobPath(next.storeSlug), JSON.stringify(next, null, 2), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
      });
    });
  map.set(next.storeSlug, job);
  try {
    await job;
  } catch {
    // keep local
  }
  return next;
}

async function load(slug: string): Promise<OrdersFile> {
  const key = slug.trim().toLowerCase();
  // Blob 為跨 instance 真實來源；不可先回記憶體快取，否則結帳寫入後其他 instance 後台看不到訂單
  if (blobConfigured()) {
    const fromBlob = await readBlob(key);
    if (fromBlob) {
      cache().set(key, fromBlob);
      return fromBlob;
    }
  }
  const hit = cache().get(key);
  if (hit) return hit;
  const fromDisk = readDisk(key);
  if (fromDisk) {
    cache().set(key, fromDisk);
    return fromDisk;
  }
  const empty = emptyFile(key);
  cache().set(key, empty);
  return empty;
}

export function createShopTradeNo(storeSlug: string) {
  const stamp = Date.now().toString().slice(-10);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const prefix = storeSlug.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
  return `PS${prefix}${stamp}${rand}`.slice(0, 20);
}

export async function listShopOrders(storeSlug: string) {
  const file = await load(storeSlug);
  return [...file.orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getShopOrder(storeSlug: string, orderId: string) {
  const file = await load(storeSlug);
  return file.orders.find((o) => o.id === orderId) ?? null;
}

export async function getShopOrderByTradeNo(tradeNo: string) {
  // 需掃描：先從 tradeNo 推 store 不易，改用全域索引檔
  const index = await loadOrderIndex();
  const hit = index[tradeNo];
  if (!hit) return null;
  return getShopOrder(hit.storeSlug, hit.orderId);
}

export async function getShopOrderByLogisticsId(logisticsId: string) {
  const index = await loadOrderIndex();
  const hit = index[`LG:${logisticsId}`] || index[logisticsId];
  if (!hit) return null;
  return getShopOrder(hit.storeSlug, hit.orderId);
}

async function indexOrderKeys(order: ShopOrder) {
  const index = await loadOrderIndex();
  if (order.tradeNo) {
    index[order.tradeNo] = { storeSlug: order.storeSlug, orderId: order.id };
  }
  if (order.logisticsTradeNo) {
    index[order.logisticsTradeNo] = {
      storeSlug: order.storeSlug,
      orderId: order.id,
    };
  }
  if (order.logisticsId) {
    index[`LG:${order.logisticsId}`] = {
      storeSlug: order.storeSlug,
      orderId: order.id,
    };
  }
  await saveOrderIndex(index);
}

type OrderIndex = Record<string, { storeSlug: string; orderId: string }>;

async function loadOrderIndex(): Promise<OrderIndex> {
  const gstore = g() as GlobalOrders & { __taiwanbizOrderIndex?: OrderIndex };
  try {
    if (blobConfigured()) {
      const result = await get("taiwanbiz/orders/_index.json", {
        access: "private",
        useCache: false,
      });
      if (result?.statusCode === 200 && result.stream) {
        const parsed = JSON.parse(
          await new Response(result.stream).text(),
        ) as OrderIndex;
        gstore.__taiwanbizOrderIndex = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  if (gstore.__taiwanbizOrderIndex) return gstore.__taiwanbizOrderIndex;
  gstore.__taiwanbizOrderIndex = {};
  return gstore.__taiwanbizOrderIndex;
}

async function saveOrderIndex(index: OrderIndex) {
  const gstore = g() as GlobalOrders & { __taiwanbizOrderIndex?: OrderIndex };
  gstore.__taiwanbizOrderIndex = index;
  if (!blobConfigured()) return;
  await put("taiwanbiz/orders/_index.json", JSON.stringify(index, null, 2), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
}

export async function createShopOrder(
  input: Omit<
    ShopOrder,
    | "createdAt"
    | "updatedAt"
    | "commissionAmount"
    | "paymentFeeEstimate"
    | "payoutAmount"
    | "totalAmount"
    | "status"
  > & { status?: ShopOrderStatus; totalAmount?: number },
) {
  const shippingFee = Math.max(0, Math.round(input.shippingFee || 0));
  const shippingPayer = input.shippingPayer === "seller" ? "seller" : "buyer";
  const discountAmount = Math.max(0, Math.round(input.discountAmount || 0));
  const fees = computeShopFees(input.subtotal, input.payment, {
    shippingFee,
    discountAmount,
    pickup: input.pickup,
  });
  const now = new Date().toISOString();
  const order: ShopOrder = {
    ...input,
    shippingFee: fees.shippingFee,
    shippingPayer,
    discountAmount: fees.discountAmount,
    totalAmount: fees.totalAmount,
    status: input.status || "pending_payment",
    createdAt: now,
    updatedAt: now,
    commissionAmount: fees.commissionAmount,
    paymentFeeEstimate: fees.paymentFeeEstimate,
    payoutAmount: fees.payoutAmount,
  };
  const file = await load(input.storeSlug);
  file.orders.unshift(order);
  await persist(file);
  await indexOrderKeys(order);
  return order;
}

export async function patchShopOrder(
  storeSlug: string,
  orderId: string,
  patch: Partial<ShopOrder>,
) {
  const file = await load(storeSlug);
  const idx = file.orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return null;
  const next = {
    ...file.orders[idx],
    ...patch,
    id: file.orders[idx].id,
    storeSlug: file.orders[idx].storeSlug,
    updatedAt: new Date().toISOString(),
  };
  file.orders[idx] = next;
  await persist(file);
  await indexOrderKeys(next);
  return next;
}

export async function markShopOrderPaid(tradeNo: string) {
  const found = await getShopOrderByTradeNo(tradeNo);
  if (!found) return null;
  if (found.status === "paid" || found.status === "preparing" || found.status === "shipped" || found.status === "completed") {
    return found;
  }
  return patchShopOrder(found.storeSlug, found.id, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
}

/** 可撥款：已付款且 paidAt 已過 7 天鑑賞期 */
export function isOrderPayoutEligible(order: ShopOrder, now = new Date()) {
  if (!order.paidAt) return false;
  if (!["paid", "preparing", "shipped", "completed"].includes(order.status)) {
    return false;
  }
  if (order.status === "cancelled" || order.status === "refunded") return false;
  const paid = new Date(order.paidAt).getTime();
  if (Number.isNaN(paid)) return false;
  return now.getTime() - paid >= 7 * 24 * 60 * 60 * 1000;
}

export async function listPayouts(storeSlug: string) {
  const file = await load(storeSlug);
  return file.payouts;
}

export async function markPayoutPaid(storeSlug: string, payoutId: string) {
  const file = await load(storeSlug);
  const idx = file.payouts.findIndex((p) => p.id === payoutId);
  if (idx < 0) return null;
  file.payouts[idx] = {
    ...file.payouts[idx],
    status: "paid",
    settledAt: new Date().toISOString(),
  };
  await persist(file);
  return file.payouts[idx];
}

/** 總管：網拍撥款摘要（網拍方案已下架，固定回空） */
export async function listAdminPayoutLedger(): Promise<
  Array<{
    storeSlug: string;
    storeName: string;
    ownerEmail: string;
    status: string;
    pendingNetAmount: number;
    lifetimeCommission: number;
  }>
> {
  return [];
}

/** 網拍月結撥款（方案已下架，不再產生批次） */
export async function runMonthlyShopPayouts(now = new Date()) {
  const settleMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodLabel = `${settleMonth.getFullYear()}-${String(settleMonth.getMonth() + 1).padStart(2, "0")}`;
  return { periodLabel, createdCount: 0, batches: [] as PayoutBatch[] };
}
