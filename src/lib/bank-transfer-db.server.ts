import type { BankTransferReport } from "@/lib/bank-transfer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "taiwanbiz-bank-transfer")
    : path.join(process.cwd(), ".data", "bank-transfer");
const DATA_FILE = path.join(DATA_DIR, "reports.json");

const g = globalThis as typeof globalThis & {
  __taiwanbizBankTransfer?: BankTransferReport[];
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): BankTransferReport[] {
  if (g.__taiwanbizBankTransfer) return g.__taiwanbizBankTransfer;
  try {
    ensureDir();
    if (!existsSync(DATA_FILE)) {
      g.__taiwanbizBankTransfer = [];
      return g.__taiwanbizBankTransfer;
    }
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as BankTransferReport[];
    g.__taiwanbizBankTransfer = Array.isArray(raw) ? raw : [];
  } catch {
    g.__taiwanbizBankTransfer = [];
  }
  return g.__taiwanbizBankTransfer;
}

function writeAll(list: BankTransferReport[]) {
  ensureDir();
  const trimmed = list.slice(0, 2000);
  g.__taiwanbizBankTransfer = trimmed;
  writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

export function saveBankTransferReport(report: BankTransferReport) {
  const list = readAll();
  list.unshift(report);
  writeAll(list);
  return report;
}

export function listBankTransferReports(status?: BankTransferReport["status"]) {
  const list = readAll();
  if (!status) return [...list];
  return list.filter((r) => r.status === status);
}

export function updateBankTransferReport(
  id: string,
  patch: Partial<BankTransferReport>,
) {
  const list = readAll();
  const hit = list.find((r) => r.id === id);
  if (!hit) return null;
  Object.assign(hit, patch);
  writeAll(list);
  return hit;
}
