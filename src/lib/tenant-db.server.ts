import {
  SEED_TENANTS,
  normalizeTenant,
  type TenantRecord,
  type TenantStatus,
} from "@/lib/tenants";
import { get, put } from "@vercel/blob";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "tenants.json");
/** Vercel Blob 私有物件路徑（跨 serverless instance 持久化） */
const BLOB_PATHNAME = "taiwanbiz/tenants.json";

type GlobalTenantStore = {
  __taiwanbizTenants?: TenantRecord[];
  __taiwanbizTenantsLoaded?: boolean;
  __taiwanbizTenantsLoadPromise?: Promise<TenantRecord[]>;
  __taiwanbizTenantsWriteChain?: Promise<void>;
};

function globalStore() {
  return globalThis as typeof globalThis & GlobalTenantStore;
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function ensureDir() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // serverless 可能無法寫入磁碟
  }
}

function readFromDisk(): TenantRecord[] | null {
  try {
    if (!existsSync(DB_PATH)) return null;
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf8")) as TenantRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((item) => normalizeTenant(item));
  } catch {
    return null;
  }
}

function writeToDisk(tenants: TenantRecord[]) {
  try {
    ensureDir();
    writeFileSync(DB_PATH, JSON.stringify(tenants, null, 2), "utf8");
  } catch {
    // ignore on read-only FS
  }
}

async function readFromBlob(): Promise<TenantRecord[] | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(BLOB_PATHNAME, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as TenantRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((item) => normalizeTenant(item));
  } catch {
    return null;
  }
}

async function writeToBlob(tenants: TenantRecord[]) {
  if (!blobConfigured()) return;
  await put(BLOB_PATHNAME, JSON.stringify(tenants, null, 2), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
}

async function loadTenants(): Promise<TenantRecord[]> {
  const g = globalStore();
  if (g.__taiwanbizTenantsLoadPromise) {
    return g.__taiwanbizTenantsLoadPromise;
  }

  g.__taiwanbizTenantsLoadPromise = (async () => {
    // Blob 為跨 instance 真實來源；刪除／開通後不可先回舊記憶體快取
    if (blobConfigured()) {
      const fromBlob = await readFromBlob();
      if (fromBlob) {
        g.__taiwanbizTenants = fromBlob;
        g.__taiwanbizTenantsLoaded = true;
        writeToDisk(fromBlob);
        return fromBlob.map((item) => normalizeTenant(item));
      }
    }

    if (g.__taiwanbizTenantsLoaded && g.__taiwanbizTenants?.length) {
      return g.__taiwanbizTenants.map((item) => normalizeTenant(item));
    }

    const fromDisk = readFromDisk();
    const seed = (fromDisk ?? SEED_TENANTS).map((item) => normalizeTenant(item));
    g.__taiwanbizTenants = seed;
    g.__taiwanbizTenantsLoaded = true;
    if (!fromDisk) writeToDisk(seed);
    // 首次上線：把 seed／本機資料灌進 Blob，之後跨 instance 共用
    if (blobConfigured()) {
      try {
        await writeToBlob(seed);
      } catch {
        // Blob 暫時失敗時仍可回傳記憶體／磁碟資料
      }
    }
    return seed;
  })();

  try {
    return await g.__taiwanbizTenantsLoadPromise;
  } finally {
    g.__taiwanbizTenantsLoadPromise = undefined;
  }
}

async function persistTenants(tenants: TenantRecord[]) {
  const normalized = tenants.map((item) => normalizeTenant(item));
  const g = globalStore();
  g.__taiwanbizTenants = normalized;
  g.__taiwanbizTenantsLoaded = true;
  writeToDisk(normalized);

  // 序列化寫入，避免併發 put 互相覆蓋
  const prev = g.__taiwanbizTenantsWriteChain ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      await writeToBlob(normalized);
    });
  g.__taiwanbizTenantsWriteChain = next;
  try {
    await next;
  } catch {
    // Blob 失敗時至少保留記憶體／磁碟
  }
  return normalized;
}

export async function listTenantDb(): Promise<TenantRecord[]> {
  const all = await loadTenants();
  return all.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

export async function getTenantDbByStoreId(
  storeId: string,
): Promise<TenantRecord | null> {
  const key = storeId.trim().toLowerCase();
  const all = await loadTenants();
  return (
    all.find(
      (item) =>
        item.storeId.toLowerCase() === key || item.slug.toLowerCase() === key,
    ) ?? null
  );
}

export async function upsertTenantDb(tenant: TenantRecord) {
  const all = await loadTenants();
  const idx = all.findIndex(
    (item) => item.storeId === tenant.storeId || item.slug === tenant.slug,
  );
  const next = normalizeTenant(tenant);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  await persistTenants(all);
  return next;
}

export async function patchTenantDb(
  storeId: string,
  patch: Partial<TenantRecord>,
): Promise<TenantRecord | null> {
  const current = await getTenantDbByStoreId(storeId);
  if (!current) return null;
  return upsertTenantDb({ ...current, ...patch, storeId: current.storeId });
}

export async function setTenantDbStatus(
  storeId: string,
  status: TenantStatus,
) {
  const patch: Partial<TenantRecord> = { status };
  if (status === "Active") {
    patch.gracePeriodEndsAt = null;
  }
  return patchTenantDb(storeId, patch);
}

export async function replaceTenantDb(tenants: TenantRecord[]) {
  await persistTenants(tenants.map((item) => normalizeTenant(item)));
}

export async function deleteTenantDb(storeId: string): Promise<boolean> {
  const key = storeId.trim().toLowerCase();
  if (!key) return false;
  const all = await loadTenants();
  const next = all.filter(
    (item) =>
      item.storeId.toLowerCase() !== key && item.slug.toLowerCase() !== key,
  );
  if (next.length === all.length) return false;
  await persistTenants(next);
  return true;
}

/** 診斷用：目前持久化後端 */
export function tenantDbBackend(): "blob" | "disk-or-memory" {
  return blobConfigured() ? "blob" : "disk-or-memory";
}
