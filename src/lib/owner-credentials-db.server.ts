import { hashPassword, verifyPassword } from "@/lib/password";
import { get, put } from "@vercel/blob";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type OwnerCredential = {
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "owner-credentials.json");
const BLOB_PATHNAME = "taiwanbiz/owner-credentials.json";

type GlobalCredStore = {
  __taiwanbizOwnerCreds?: OwnerCredential[];
  __taiwanbizOwnerCredsLoaded?: boolean;
  __taiwanbizOwnerCredsLoadPromise?: Promise<OwnerCredential[]>;
  __taiwanbizOwnerCredsWriteChain?: Promise<void>;
};

function globalStore() {
  return globalThis as typeof globalThis & GlobalCredStore;
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function ensureDir() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function readFromBlob(): Promise<OwnerCredential[] | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(BLOB_PATHNAME, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as OwnerCredential[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => ({
      email: normalizeEmail(item.email),
      passwordHash: String(item.passwordHash || ""),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    }));
  } catch {
    return null;
  }
}

function readFromDisk(): OwnerCredential[] | null {
  try {
    if (!existsSync(DB_PATH)) return null;
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf8")) as OwnerCredential[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToDisk(rows: OwnerCredential[]) {
  try {
    ensureDir();
    writeFileSync(DB_PATH, JSON.stringify(rows, null, 2), "utf8");
  } catch {
    // ignore
  }
}

async function writeToBlob(rows: OwnerCredential[]) {
  if (!blobConfigured()) return;
  await put(BLOB_PATHNAME, JSON.stringify(rows, null, 2), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

async function loadAll(): Promise<OwnerCredential[]> {
  const g = globalStore();
  if (g.__taiwanbizOwnerCredsLoaded && g.__taiwanbizOwnerCreds) {
    return g.__taiwanbizOwnerCreds;
  }
  if (g.__taiwanbizOwnerCredsLoadPromise) {
    return g.__taiwanbizOwnerCredsLoadPromise;
  }

  g.__taiwanbizOwnerCredsLoadPromise = (async () => {
    const fromBlob = await readFromBlob();
    const rows = fromBlob ?? readFromDisk() ?? [];
    g.__taiwanbizOwnerCreds = rows;
    g.__taiwanbizOwnerCredsLoaded = true;
    if (!fromBlob && blobConfigured() && rows.length) {
      try {
        await writeToBlob(rows);
      } catch {
        // ignore
      }
    }
    return rows;
  })();

  try {
    return await g.__taiwanbizOwnerCredsLoadPromise;
  } finally {
    g.__taiwanbizOwnerCredsLoadPromise = undefined;
  }
}

async function persist(rows: OwnerCredential[]) {
  const g = globalStore();
  g.__taiwanbizOwnerCreds = rows;
  g.__taiwanbizOwnerCredsLoaded = true;
  writeToDisk(rows);
  const prev = g.__taiwanbizOwnerCredsWriteChain ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(async () => {
    await writeToBlob(rows);
  });
  g.__taiwanbizOwnerCredsWriteChain = next;
  try {
    await next;
  } catch {
    // keep memory/disk
  }
}

export async function getOwnerCredential(email: string) {
  const key = normalizeEmail(email);
  if (!key) return null;
  const all = await loadAll();
  return all.find((item) => item.email === key) ?? null;
}

export async function ownerHasPassword(email: string) {
  const row = await getOwnerCredential(email);
  return Boolean(row?.passwordHash);
}

export async function setOwnerPassword(input: {
  email: string;
  password: string;
  /** 若已有密碼，必須提供正確的舊密碼才能更換 */
  currentPassword?: string;
  /** 強制覆寫（僅內部開通流程使用，例如結帳當下綁定） */
  force?: boolean;
}) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false as const, error: "Email 無效" };

  const all = await loadAll();
  const idx = all.findIndex((item) => item.email === email);
  const existing = idx >= 0 ? all[idx] : null;

  if (existing?.passwordHash && !input.force) {
    if (!input.currentPassword) {
      return { ok: false as const, error: "請輸入目前密碼" };
    }
    if (!verifyPassword(input.currentPassword, existing.passwordHash)) {
      return { ok: false as const, error: "目前密碼不正確" };
    }
  }

  const now = new Date().toISOString();
  const row: OwnerCredential = {
    email,
    passwordHash: hashPassword(input.password),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await persist(all);
  return { ok: true as const, created: !existing };
}

export async function verifyOwnerPassword(email: string, password: string) {
  const row = await getOwnerCredential(email);
  if (!row?.passwordHash) return { ok: false as const, reason: "unset" as const };
  if (!verifyPassword(password, row.passwordHash)) {
    return { ok: false as const, reason: "mismatch" as const };
  }
  return { ok: true as const, reason: "ok" as const };
}
