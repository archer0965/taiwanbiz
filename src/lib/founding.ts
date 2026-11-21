import {
  applyFoundingDiscount,
  FOUNDING_MEMBER_LIMIT,
} from "@/lib/pricing";
import { listTenantDb } from "@/lib/tenant-db.server";
import type { TenantRecord } from "@/lib/tenants";

/** 已占用創始名額的店家（含待付款／已啟用） */
export function countFoundingMembers(tenants: TenantRecord[]) {
  return tenants.filter((t) => t.isFoundingMember).length;
}

export async function getFoundingAvailability() {
  const tenants = await listTenantDb();
  const used = countFoundingMembers(tenants);
  const remaining = Math.max(0, FOUNDING_MEMBER_LIMIT - used);
  return {
    limit: FOUNDING_MEMBER_LIMIT,
    used,
    remaining,
    available: remaining > 0,
  };
}

/**
 * 創始資格一經取得即終身有效（續費終身 8 折）：
 * 升降級／續約皆沿用，不可因額滿或未勾選而喪失。
 */
export function resolveLifelongFounding(
  tenant: Pick<TenantRecord, "isFoundingMember"> | null | undefined,
  wantFounding = false,
) {
  return Boolean(tenant?.isFoundingMember || wantFounding);
}

/** 依創始資格計算應付月費（創始＝終身 8 折） */
export function foundingPayAmount(
  listAmount: number,
  tenant: Pick<TenantRecord, "isFoundingMember"> | null | undefined,
  wantFounding = false,
) {
  return applyFoundingDiscount(
    listAmount,
    resolveLifelongFounding(tenant, wantFounding),
  );
}
