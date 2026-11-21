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
 * 早鳥資格一經取得即終身有效（月 9／半年 85／年 8 折）：
 * 升降級／續約皆沿用，不可因額滿或未勾選而喪失。
 */
export function resolveLifelongFounding(
  tenant: Pick<TenantRecord, "isFoundingMember"> | null | undefined,
  wantFounding = false,
) {
  return Boolean(tenant?.isFoundingMember || wantFounding);
}

/** 依早鳥資格計算應付金額（預設以月繳 9 折） */
export function foundingPayAmount(
  listAmount: number,
  tenant: Pick<TenantRecord, "isFoundingMember"> | null | undefined,
  wantFounding = false,
  cycle: "monthly" | "half_yearly" | "annual" | "yearly" = "monthly",
) {
  return applyFoundingDiscount(
    listAmount,
    resolveLifelongFounding(tenant, wantFounding),
    cycle,
  );
}
