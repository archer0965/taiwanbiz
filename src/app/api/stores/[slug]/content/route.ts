import { auth } from "@/auth";
import {
  buildDemoCampaign,
  getDemoTemplate,
  type DemoTemplateId,
} from "@/lib/demo-templates";
import { isDeveloperEmail } from "@/lib/roles";
import {
  getStoreContent,
  patchStoreContent,
  storeTenantFromContent,
} from "@/lib/store-content-db.server";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import { NextResponse } from "next/server";

export const instant = false;

type Props = { params: Promise<{ slug: string }> };

/** 公開：讀取店家前台內容 */
export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const content = await getStoreContent(slug);
  if (!content) {
    return NextResponse.json({ ok: false, found: false }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    found: true,
    content,
    store: storeTenantFromContent(content),
  });
}

/** 店主／總管：更新店家內容 */
export async function PATCH(request: Request, { params }: Props) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() || "";
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const tenant = await getTenantDbByStoreId(slug);
  const isOwner =
    tenant && tenant.ownerEmail.trim().toLowerCase() === email;
  if (!isDeveloperEmail(email) && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.seedDemo) {
    const templateId = (
      body.demoTemplateId === "hair-salon" ? "hair-salon" : "nail-lash"
    ) as DemoTemplateId;
    const template = getDemoTemplate(templateId);
    const campaign = buildDemoCampaign(template);
    const seeded = await patchStoreContent(slug, {
      mode: "service",
      theme: template.accent === "rose" ? "nail" : "brunch",
      campaign: {
        name: campaign.name,
        prize: campaign.prize,
        expiresAt: campaign.expiresAt,
        quota: campaign.quota,
        prizes: campaign.prizes,
      },
      staff: template.staffOptions
        .filter((name) => name !== "不指定")
        .map((name, index) => ({
          id: `staff-demo-${index}`,
          name,
          active: true,
          isOwner: index === 0,
        })),
      bookingTerms: undefined,
      profile: {
        name: tenant?.name || slug,
        category: template.category,
        tagline: template.tagline,
        description: template.descriptionBody,
        accent: template.accent,
        products: template.products,
        showCampaign: true,
        showContactForm: true,
        announcement: "14 天免費體驗 Demo：可分享此前台連結給店主預覽。",
        welcomeMessage: `歡迎光臨！線上預約後系統會通知店家，並於行前提醒您到店。`,
      } as never,
    });
    if (!seeded) {
      return NextResponse.json({ error: "找不到店家" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      content: seeded,
      store: storeTenantFromContent(seeded),
      demoTemplateId: templateId,
      previewPath: `/stores/${slug}`,
    });
  }

  const updated = await patchStoreContent(slug, body as never);
  if (!updated) {
    return NextResponse.json({ error: "找不到店家" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    content: updated,
    store: storeTenantFromContent(updated),
  });
}
