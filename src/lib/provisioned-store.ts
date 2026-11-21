import type { StoreTenant } from "@/data/stores-db";
import {
  buildDemoCampaign,
  getDemoTemplate,
  type DemoTemplateId,
} from "@/lib/demo-templates";
import type { TenantRecord } from "@/lib/tenants";

/** 由總管理後台開通、尚未寫入靜態 DB 的店家，產生可預覽的租戶資料 */
export function buildProvisionedStore(
  tenant: TenantRecord,
  templateId: DemoTemplateId = "nail-lash",
): StoreTenant {
  const template = getDemoTemplate(templateId);
  const campaign = buildDemoCampaign(template);
  const theme =
    template.accent === "rose"
      ? ("nail" as const)
      : template.accent === "amber"
        ? ("brunch" as const)
        : ("brunch" as const);

  return {
    slug: tenant.slug,
    name: tenant.name,
    category: template.category,
    tagline: template.tagline,
    description: `${tenant.name}｜${template.descriptionBody} 方案：${tenant.planType}。`,
    phone: "0900-000-000",
    hours: "週二至週日 11:00–20:00（週一公休）",
    address: "請於後台設定門市地址",
    mapUrl: "https://maps.google.com/?q=台灣",
    lineUrl: "https://line.me/R/ti/p/@469uykad",
    banner:
      template.id === "hair-salon"
        ? "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1800&q=80"
        : "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1800&q=80",
    theme,
    mode: "service",
    announcement: "14 天免費體驗 Demo：可直接分享前台連結給店主預覽。",
    welcomeMessage: `歡迎光臨 ${tenant.name}！線上預約後系統會通知店家，並於行前提醒您到店。`,
    showCampaign: true,
    showContactForm: true,
    products: template.products,
    campaign: {
      name: campaign.name,
      prize: campaign.prize,
      expiresAt: campaign.expiresAt,
      quota: campaign.quota,
      prizes: campaign.prizes,
    },
  };
}
