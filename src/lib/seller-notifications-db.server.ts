import type {
  SellerNotification,
  SellerNotificationKind,
} from "@/lib/seller-notifications";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type { SellerNotification, SellerNotificationKind };

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "taiwanbiz-notifications")
    : path.join(process.cwd(), ".data", "notifications");
const DATA_FILE = path.join(DATA_DIR, "all.json");

const g = globalThis as typeof globalThis & {
  __taiwanbizSellerNotifications?: SellerNotification[];
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): SellerNotification[] {
  if (g.__taiwanbizSellerNotifications) return g.__taiwanbizSellerNotifications;
  try {
    ensureDir();
    if (!existsSync(DATA_FILE)) {
      g.__taiwanbizSellerNotifications = [];
      return g.__taiwanbizSellerNotifications;
    }
    const raw = JSON.parse(
      readFileSync(DATA_FILE, "utf8"),
    ) as SellerNotification[];
    g.__taiwanbizSellerNotifications = Array.isArray(raw) ? raw : [];
  } catch {
    g.__taiwanbizSellerNotifications = [];
  }
  return g.__taiwanbizSellerNotifications;
}

function writeAll(list: SellerNotification[]) {
  ensureDir();
  const trimmed = list.slice(0, 5000);
  g.__taiwanbizSellerNotifications = trimmed;
  writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

export function createNotificationId() {
  return `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function pushSellerNotification(
  input: Omit<SellerNotification, "id" | "createdAt" | "readAt"> & {
    id?: string;
    createdAt?: string;
  },
) {
  const record: SellerNotification = {
    id: input.id || createNotificationId(),
    storeId: input.storeId.trim().toLowerCase(),
    ownerEmail: input.ownerEmail.trim().toLowerCase(),
    kind: input.kind,
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 500),
    href: input.href,
    createdAt: input.createdAt || new Date().toISOString(),
    readAt: null,
  };
  const list = readAll();
  list.unshift(record);
  writeAll(list);
  return record;
}

export function listSellerNotifications(input: {
  ownerEmail?: string;
  storeId?: string;
  limit?: number;
}) {
  const email = input.ownerEmail?.trim().toLowerCase();
  const storeId = input.storeId?.trim().toLowerCase();
  const limit = Math.min(100, Math.max(1, input.limit || 30));
  return readAll()
    .filter((n) => {
      if (email && n.ownerEmail !== email) return false;
      if (storeId && n.storeId !== storeId) return false;
      return true;
    })
    .slice(0, limit);
}

export function markSellerNotificationRead(id: string, ownerEmail: string) {
  const email = ownerEmail.trim().toLowerCase();
  const list = readAll();
  const hit = list.find((n) => n.id === id && n.ownerEmail === email);
  if (!hit) return null;
  hit.readAt = new Date().toISOString();
  writeAll(list);
  return hit;
}

export function markAllSellerNotificationsRead(ownerEmail: string) {
  const email = ownerEmail.trim().toLowerCase();
  const list = readAll();
  const now = new Date().toISOString();
  let count = 0;
  for (const n of list) {
    if (n.ownerEmail === email && !n.readAt) {
      n.readAt = now;
      count += 1;
    }
  }
  writeAll(list);
  return count;
}
