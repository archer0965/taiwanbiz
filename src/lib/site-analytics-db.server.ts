import { get, put } from "@vercel/blob";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "site-analytics.json");
const BLOB_PATHNAME = "taiwanbiz/site-analytics.json";
const MAX_DAYS = 90;
const MAX_PATHS = 200;

export type DayBucket = {
  date: string;
  total: number;
  paths: Record<string, number>;
};

export type SiteAnalyticsFile = {
  version: 1;
  updatedAt: string;
  totalViews: number;
  days: DayBucket[];
  paths: Record<string, number>;
};

export type SiteAnalyticsSummary = {
  totalViews: number;
  todayViews: number;
  yesterdayViews: number;
  last7Views: number;
  last30Views: number;
  updatedAt: string;
  daily: Array<{ date: string; total: number }>;
  topPaths: Array<{ path: string; views: number; share: number }>;
  categories: Array<{ id: string; label: string; views: number }>;
  backend: "blob" | "disk-or-memory";
};

type GlobalAnalyticsStore = {
  __taiwanbizAnalytics?: SiteAnalyticsFile;
  __taiwanbizAnalyticsLoaded?: boolean;
  __taiwanbizAnalyticsLoadPromise?: Promise<SiteAnalyticsFile>;
  __taiwanbizAnalyticsWriteChain?: Promise<void>;
};

function globalStore() {
  return globalThis as typeof globalThis & GlobalAnalyticsStore;
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function emptyFile(): SiteAnalyticsFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    totalViews: 0,
    days: [],
    paths: {},
  };
}

function ensureDir() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // serverless may be read-only
  }
}

function normalizePath(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let p = raw.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  // strip query / hash
  p = p.split("?")[0]?.split("#")[0] || "/";
  // collapse trailing slash (except root)
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  if (p.length > 180) return null;
  if (p.startsWith("/api")) return null;
  if (p.startsWith("/_next")) return null;
  if (p.includes("..")) return null;
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return null;
  return p || "/";
}

function taiwanDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setTime(d.getTime() - n * 24 * 60 * 60 * 1000);
  return taiwanDate(d);
}

function prunePaths(paths: Record<string, number>): Record<string, number> {
  const entries = Object.entries(paths).sort((a, b) => b[1] - a[1]);
  if (entries.length <= MAX_PATHS) return paths;
  return Object.fromEntries(entries.slice(0, MAX_PATHS));
}

function normalizeFile(raw: Partial<SiteAnalyticsFile> | null): SiteAnalyticsFile {
  if (!raw || raw.version !== 1) return emptyFile();
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    totalViews: Number(raw.totalViews) || 0,
    days: Array.isArray(raw.days)
      ? raw.days
          .filter((d) => d && typeof d.date === "string")
          .map((d) => ({
            date: d.date,
            total: Number(d.total) || 0,
            paths:
              d.paths && typeof d.paths === "object"
                ? Object.fromEntries(
                    Object.entries(d.paths).map(([k, v]) => [k, Number(v) || 0]),
                  )
                : {},
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-MAX_DAYS)
      : [],
    paths:
      raw.paths && typeof raw.paths === "object"
        ? prunePaths(
            Object.fromEntries(
              Object.entries(raw.paths).map(([k, v]) => [k, Number(v) || 0]),
            ),
          )
        : {},
  };
}

function readFromDisk(): SiteAnalyticsFile | null {
  try {
    if (!existsSync(DB_PATH)) return null;
    return normalizeFile(JSON.parse(readFileSync(DB_PATH, "utf8")));
  } catch {
    return null;
  }
}

function writeToDisk(file: SiteAnalyticsFile) {
  try {
    ensureDir();
    writeFileSync(DB_PATH, JSON.stringify(file, null, 2), "utf8");
  } catch {
    // ignore
  }
}

async function readFromBlob(): Promise<SiteAnalyticsFile | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(BLOB_PATHNAME, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return normalizeFile(JSON.parse(text));
  } catch {
    return null;
  }
}

async function writeToBlob(file: SiteAnalyticsFile) {
  if (!blobConfigured()) return;
  await put(BLOB_PATHNAME, JSON.stringify(file, null, 2), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
}

async function loadAnalytics(): Promise<SiteAnalyticsFile> {
  const g = globalStore();
  if (g.__taiwanbizAnalyticsLoadPromise) {
    return g.__taiwanbizAnalyticsLoadPromise;
  }

  g.__taiwanbizAnalyticsLoadPromise = (async () => {
    if (blobConfigured()) {
      const fromBlob = await readFromBlob();
      if (fromBlob) {
        g.__taiwanbizAnalytics = fromBlob;
        g.__taiwanbizAnalyticsLoaded = true;
        writeToDisk(fromBlob);
        return fromBlob;
      }
    }

    if (g.__taiwanbizAnalyticsLoaded && g.__taiwanbizAnalytics) {
      return g.__taiwanbizAnalytics;
    }

    const fromDisk = readFromDisk();
    const next = fromDisk ?? emptyFile();
    g.__taiwanbizAnalytics = next;
    g.__taiwanbizAnalyticsLoaded = true;
    if (!fromDisk) writeToDisk(next);
    if (blobConfigured()) {
      try {
        await writeToBlob(next);
      } catch {
        // keep memory/disk
      }
    }
    return next;
  })();

  try {
    return await g.__taiwanbizAnalyticsLoadPromise;
  } finally {
    g.__taiwanbizAnalyticsLoadPromise = undefined;
  }
}

function applyView(file: SiteAnalyticsFile, pathKey: string): SiteAnalyticsFile {
  const date = taiwanDate();
  const days = [...file.days];
  let day = days.find((d) => d.date === date);
  if (!day) {
    day = { date, total: 0, paths: {} };
    days.push(day);
  }
  day.total += 1;
  day.paths[pathKey] = (day.paths[pathKey] || 0) + 1;

  const paths = { ...file.paths };
  paths[pathKey] = (paths[pathKey] || 0) + 1;

  return normalizeFile({
    version: 1,
    updatedAt: new Date().toISOString(),
    totalViews: (file.totalViews || 0) + 1,
    days: days.slice(-MAX_DAYS),
    paths: prunePaths(paths),
  });
}

export function analyticsBackend(): "blob" | "disk-or-memory" {
  return blobConfigured() ? "blob" : "disk-or-memory";
}

export async function recordSiteView(rawPath: string): Promise<{
  ok: boolean;
  path?: string;
  error?: string;
}> {
  const pathKey = normalizePath(rawPath);
  if (!pathKey) return { ok: false, error: "invalid path" };

  const g = globalStore();
  const prev = g.__taiwanbizAnalyticsWriteChain ?? Promise.resolve();
  let resultPath = pathKey;
  const chain = prev.catch(() => undefined).then(async () => {
    // 序列化讀寫，降低併發漏計
    const latestBlob = blobConfigured() ? await readFromBlob() : null;
    const mem = g.__taiwanbizAnalytics;
    const base =
      latestBlob &&
      (!mem ||
        latestBlob.totalViews >= mem.totalViews ||
        latestBlob.updatedAt >= mem.updatedAt)
        ? latestBlob
        : mem
          ? mem
          : await loadAnalytics();
    const next = applyView(base, pathKey);
    g.__taiwanbizAnalytics = next;
    g.__taiwanbizAnalyticsLoaded = true;
    writeToDisk(next);
    await writeToBlob(next);
    resultPath = pathKey;
  });
  g.__taiwanbizAnalyticsWriteChain = chain;
  try {
    await chain;
  } catch {
    // 仍嘗試以記憶體累加，避免完全失敗
    const current = g.__taiwanbizAnalytics ?? (await loadAnalytics());
    const next = applyView(current, pathKey);
    g.__taiwanbizAnalytics = next;
    writeToDisk(next);
  }
  return { ok: true, path: resultPath };
}

function sumDays(file: SiteAnalyticsFile, fromDate: string): number {
  return file.days
    .filter((d) => d.date >= fromDate)
    .reduce((sum, d) => sum + d.total, 0);
}

function categorizePath(p: string): { id: string; label: string } {
  if (p === "/" || p === "") return { id: "home", label: "首頁" };
  if (p.startsWith("/pricing")) return { id: "pricing", label: "方案價格" };
  if (p.startsWith("/stores")) return { id: "stores", label: "店家前台／案例" };
  if (p.startsWith("/login") || p.startsWith("/welcome") || p.startsWith("/dashboard") || p.startsWith("/admin") || p.startsWith("/billing")) {
    return { id: "app", label: "登入／後台" };
  }
  if (p.startsWith("/terms") || p.startsWith("/privacy")) {
    return { id: "legal", label: "條款／隱私" };
  }
  return { id: "other", label: "其他頁面" };
}

export async function getSiteAnalyticsSummary(): Promise<SiteAnalyticsSummary> {
  const file = await loadAnalytics();
  const today = taiwanDate();
  const yesterday = daysAgo(1);
  const from7 = daysAgo(6);
  const from30 = daysAgo(29);

  const todayViews =
    file.days.find((d) => d.date === today)?.total ?? 0;
  const yesterdayViews =
    file.days.find((d) => d.date === yesterday)?.total ?? 0;

  // fill last 14 days for chart continuity
  const daily: Array<{ date: string; total: number }> = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = daysAgo(i);
    daily.push({
      date,
      total: file.days.find((d) => d.date === date)?.total ?? 0,
    });
  }

  const totalForShare = file.totalViews || 1;
  const topPaths = Object.entries(file.paths)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([pathKey, views]) => ({
      path: pathKey,
      views,
      share: Math.round((views / totalForShare) * 1000) / 10,
    }));

  const catMap = new Map<string, { id: string; label: string; views: number }>();
  for (const [pathKey, views] of Object.entries(file.paths)) {
    const cat = categorizePath(pathKey);
    const prev = catMap.get(cat.id);
    if (prev) prev.views += views;
    else catMap.set(cat.id, { ...cat, views });
  }

  return {
    totalViews: file.totalViews,
    todayViews,
    yesterdayViews,
    last7Views: sumDays(file, from7),
    last30Views: sumDays(file, from30),
    updatedAt: file.updatedAt,
    daily,
    topPaths,
    categories: Array.from(catMap.values()).sort((a, b) => b.views - a.views),
    backend: analyticsBackend(),
  };
}
