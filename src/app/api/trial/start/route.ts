import { auth } from "@/auth";
import { getFoundingAvailability } from "@/lib/founding";
import { STANDARD_TRIAL_DAYS, START_TRIAL_BUTTON_LABEL } from "@/lib/pricing";
import { isDeveloperEmail } from "@/lib/roles";
import { startFreeTrial } from "@/lib/subscription-billing";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { NextResponse } from "next/server";

export const instant = false;

type Body = {
  storeId?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!email) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storeId = String(body.storeId || "")
    .trim()
    .toLowerCase();
  if (!storeId) {
    return NextResponse.json({ error: "缺少 storeId" }, { status: 400 });
  }

  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) {
    return NextResponse.json({ error: "找不到店家" }, { status: 404 });
  }

  const isAdmin = isDeveloperEmail(email);
  const owner = tenant.ownerEmail.trim().toLowerCase() === email;
  if (!isAdmin && !owner) {
    return NextResponse.json({ error: "無權限操作此店家" }, { status: 403 });
  }

  const result = await startFreeTrial({
    storeId,
    name: tenant.name,
    ownerEmail: tenant.ownerEmail,
    planType: tenant.planType,
    planName: tenant.planName || undefined,
    listAmount: tenant.listAmount ?? undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "無法開通試用" },
      { status: 400 },
    );
  }

  const founding =
    "founding" in result && result.founding
      ? result.founding
      : await getFoundingAvailability();

  return NextResponse.json({
    ok: true,
    trialEndsAt: result.trialEndsAt,
    earlyBird:
      "earlyBird" in result
        ? result.earlyBird
        : result.tenant.isFoundingMember,
    alreadyOnTrial:
      "alreadyOnTrial" in result ? result.alreadyOnTrial : false,
    trialDays: STANDARD_TRIAL_DAYS,
    buttonLabel: START_TRIAL_BUTTON_LABEL,
    message: result.message,
    founding,
    tenant: result.tenant,
  });
}
