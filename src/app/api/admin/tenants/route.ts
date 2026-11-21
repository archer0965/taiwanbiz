import { auth } from "@/auth";
import { isDeveloperEmail } from "@/lib/roles";
import {
  deleteTenantDb,
  getTenantDbByStoreId,
  listTenantDb,
  tenantDbBackend,
  upsertTenantDb,
} from "@/lib/tenant-db.server";
import { del } from "@vercel/blob";
import { resolveLifelongFounding } from "@/lib/founding";
import { ensureStoreContentForTenant } from "@/lib/store-content-db.server";
import {
  cancelSubscription,
  changeTenantPlan,
  issueRenewalLink,
  manualOverrideStatus,
} from "@/lib/subscription-billing";
import {
  normalizeTenant,
  planMonthlyAmount,
  toTenantDbRow,
  type TenantPlanType,
  type TenantRecord,
  type TenantStatus,
} from "@/lib/tenants";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email;
  if (!isDeveloperEmail(email)) {
    return null;
  }
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenants = await listTenantDb();
  return NextResponse.json({
    ok: true,
    backend: tenantDbBackend(),
    tenants,
    schema: tenants.map(toTenantDbRow),
  });
}

type PatchBody = {
  storeId?: string;
  store_id?: string;
  status?: TenantStatus;
  action?:
    | "activate"
    | "suspend"
    | "pending"
    | "upsert"
    | "renew"
    | "change-plan"
    | "cancel-subscription"
    | "delete";
  reason?: string;
  immediate?: boolean;
  planType?: TenantPlanType;
  planName?: string;
  listAmount?: number;
  tenant?: Partial<TenantRecord> & {
    slug?: string;
    name?: string;
    planType?: TenantPlanType;
  };
};

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "upsert" && body.tenant?.slug && body.tenant.name) {
    const existing = await getTenantDbByStoreId(body.tenant.slug);
    const planType =
      body.tenant.planType || existing?.planType || "self-serve";
    const isFoundingMember = resolveLifelongFounding(
      existing,
      Boolean(body.tenant.isFoundingMember),
    );
    const listAmount =
      typeof body.tenant.listAmount === "number" && body.tenant.listAmount > 0
        ? body.tenant.listAmount
        : existing?.listAmount && existing.planType === planType
          ? existing.listAmount
          : planMonthlyAmount(planType);
    const saved = await upsertTenantDb(
      normalizeTenant({
        ...existing,
        ...body.tenant,
        slug: body.tenant.slug,
        name: body.tenant.name,
        planType,
        storeId: body.tenant.storeId || body.tenant.slug,
        isFoundingMember,
        listAmount,
      }),
    );
    await ensureStoreContentForTenant(saved.slug);
    return NextResponse.json({
      ok: true,
      backend: tenantDbBackend(),
      tenant: saved,
      schema: toTenantDbRow(saved),
    });
  }

  const storeId = (body.storeId || body.store_id || "").trim().toLowerCase();
  if (!storeId) {
    return NextResponse.json({ error: "缺少 store_id" }, { status: 400 });
  }

  if (body.action === "change-plan") {
    const planType = "self-serve" as const;
    const result = await changeTenantPlan({
      storeId,
      planType,
      planName: body.planName,
      listAmount: body.listAmount,
    });
    if (!result?.tenant) {
      return NextResponse.json({ error: "找不到店家" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      backend: tenantDbBackend(),
      tenant: result.tenant,
      schema: toTenantDbRow(result.tenant),
      listAmount: result.listAmount,
      payAmount: result.payAmount,
      isFoundingMember: result.isFoundingMember,
      message: result.isFoundingMember
        ? `已升降級；創始 8 折應付 NT$ ${result.payAmount}（原價 NT$ ${result.listAmount}）`
        : `已升降級；月費 NT$ ${result.payAmount}`,
    });
  }

  if (body.action === "renew") {
    const result = await issueRenewalLink(storeId);
    if (!result) {
      return NextResponse.json({ error: "找不到店家" }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      renewUrl: result.renewUrl,
      amount: result.amount,
      tenant: result.tenant,
      schema: result.tenant ? toTenantDbRow(result.tenant) : null,
    });
  }

  if (body.action === "cancel-subscription") {
    const session = await requireAdmin();
    const result = await cancelSubscription({
      storeId,
      reason: body.reason,
      immediate: body.immediate !== false, // 總管預設立即停用
      actorEmail: session?.user?.email || undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message: result.message,
      alreadyCancelled: result.alreadyCancelled,
      ecpay: result.ecpay,
      tenant: result.tenant,
      schema: result.tenant ? toTenantDbRow(result.tenant) : null,
    });
  }

  if (body.action === "delete") {
    const existing = await getTenantDbByStoreId(storeId);
    if (!existing) {
      return NextResponse.json({ error: "找不到店家" }, { status: 404 });
    }
    const ok = await deleteTenantDb(storeId);
    if (!ok) {
      return NextResponse.json({ error: "刪除失敗" }, { status: 500 });
    }
    // 一併清掉店家內容／訂單 Blob（失敗不阻斷）
    if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      try {
        await del(
          [
            `taiwanbiz/stores/${existing.slug}.json`,
            `taiwanbiz/orders/${existing.slug}.json`,
          ],
          { token: process.env.BLOB_READ_WRITE_TOKEN },
        );
      } catch {
        // ignore missing blobs
      }
    }
    const tenants = await listTenantDb();
    return NextResponse.json({
      ok: true,
      deleted: existing.slug,
      message: `已刪除店家 ${existing.name}（${existing.slug}）`,
      tenants,
      backend: tenantDbBackend(),
    });
  }

  let status = body.status;
  if (body.action === "activate") status = "Active";
  if (body.action === "suspend") status = "Suspended";
  if (body.action === "pending") status = "Pending";
  if (!status) {
    return NextResponse.json({ error: "缺少 status / action" }, { status: 400 });
  }

  const updated = await manualOverrideStatus(storeId, status);
  if (!updated) {
    return NextResponse.json({ error: "找不到店家" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    backend: tenantDbBackend(),
    tenant: updated,
    schema: toTenantDbRow(updated),
  });
}
