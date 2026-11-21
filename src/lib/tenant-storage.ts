import {
  SEED_TENANTS,
  isValidSlug,
  normalizeTenant,
  type TenantPlanType,
  type TenantRecord,
  type TenantStatus,
} from "@/lib/tenants";

const KEY = "taiwanbiz.tenants.v1";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAll(): TenantRecord[] {
  if (!canUseStorage()) return SEED_TENANTS.map((t) => normalizeTenant(t));
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seed = SEED_TENANTS.map((t) => normalizeTenant(t));
      localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as TenantRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seed = SEED_TENANTS.map((t) => normalizeTenant(t));
      localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    return parsed.map((item) => normalizeTenant(item));
  } catch {
    return SEED_TENANTS.map((t) => normalizeTenant(t));
  }
}

function writeAll(tenants: TenantRecord[]) {
  if (!canUseStorage()) return false;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(tenants.map((item) => normalizeTenant(item))),
    );
    window.dispatchEvent(new Event("taiwanbiz-storage"));
    return true;
  } catch {
    return false;
  }
}

export function listTenants(): TenantRecord[] {
  return readAll().sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

export function replaceTenants(tenants: TenantRecord[]) {
  return writeAll(tenants.map((item) => normalizeTenant(item)));
}

export function getTenantBySlug(slug: string): TenantRecord | null {
  return readAll().find((item) => item.slug === slug || item.storeId === slug) ?? null;
}

export function getTenantsByOwnerEmail(email: string): TenantRecord[] {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];
  return listTenants().filter(
    (item) => item.ownerEmail.trim().toLowerCase() === normalized,
  );
}

export function setTenantStatus(slug: string, status: TenantStatus) {
  const all = readAll();
  const next = all.map((item) =>
    item.slug === slug || item.storeId === slug
      ? normalizeTenant({
          ...item,
          status,
          gracePeriodEndsAt: status === "Active" ? null : item.gracePeriodEndsAt,
        })
      : item,
  );
  return writeAll(next);
}

export function upsertLocalTenant(tenant: TenantRecord) {
  const all = readAll();
  const idx = all.findIndex(
    (item) => item.slug === tenant.slug || item.storeId === tenant.storeId,
  );
  const next = normalizeTenant(tenant);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  return writeAll(all);
}

export function toggleTenantStatus(slug: string): TenantStatus | null {
  const current = getTenantBySlug(slug);
  if (!current) return null;
  const status =
    current.status === "Active"
      ? "Suspended"
      : current.status === "Suspended"
        ? "Active"
        : "Active";
  setTenantStatus(slug, status);
  return status;
}

export type ProvisionTenantInput = {
  name: string;
  slug: string;
  planType: TenantPlanType;
  ownerEmail: string;
  expiresAt?: string;
};

export function provisionTenant(
  input: ProvisionTenantInput,
): { ok: true; tenant: TenantRecord } | { ok: false; error: string } {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();

  if (!name) return { ok: false, error: "請填寫店家名稱" };
  if (!isValidSlug(slug)) {
    return {
      ok: false,
      error: "Slug 僅能使用小寫英文、數字與連字號（例：my-select-shop）",
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return { ok: false, error: "請填寫正確的老闆 Email" };
  }
  if (readAll().some((item) => item.slug === slug)) {
    return { ok: false, error: `Slug「${slug}」已被使用` };
  }

  const expires = input.expiresAt?.trim() || defaultExpiry();
  const tenant = normalizeTenant({
    id: `t-${slug}-${Date.now().toString(36)}`,
    storeId: slug,
    name,
    slug,
    planType: input.planType,
    status: "Pending",
    expiresAt: expires,
    nextBillingDate: null,
    gracePeriodEndsAt: null,
    merchantMemberId: null,
    cardToken: null,
    pageViews: 0,
    ownerEmail,
    createdAt: new Date().toISOString(),
  });

  const ok = writeAll([tenant, ...readAll()]);
  if (!ok) return { ok: false, error: "無法寫入本機資料，請檢查瀏覽器儲存空間" };
  return { ok: true, tenant };
}

function defaultExpiry() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
