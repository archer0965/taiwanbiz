/**
 * 相容層：儀表板與舊程式仍可從 mock-data 讀取型別／預設值。
 * 多租戶店家真實資料來源為 `@/data/stores-db`。
 */

import {
  getStoreBySlug,
  STORES_DB,
  type StoreCampaign,
  type StoreProduct,
  type StoreTenant,
  type StoreTheme,
} from "@/data/stores-db";
import {
  buildDefaultBeautyPrizes,
  buildDefaultBrunchPrizes,
  summarizePrizes,
  type CampaignPrizeTier,
} from "@/lib/campaign-prizes";

export type { StoreCampaign, StoreProduct, StoreTheme };
export type { StoreTenant };
export type { CampaignPrizeTier };

export type StoreProfile = {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  phone: string;
  hours: string;
  address: string;
  mapUrl: string;
  lineUrl: string;
  banner: string;
  accent: "emerald" | "rose" | "amber";
  theme: StoreTheme;
  announcement: string;
  welcomeMessage: string;
  showCampaign: boolean;
  showContactForm: boolean;
  products: StoreProduct[];
  campaign: StoreCampaign;
};

export type LeadRecord = {
  id: string;
  createdAt: string;
  phone: string;
  campaignName: string;
  couponCode: string;
  /** 實際抽中的獎項名稱 */
  prizeLabel?: string;
  prizeTierId?: string;
  status: "未兌換" | "已兌換";
};

export type CampaignDraft = {
  name: string;
  /** 獎項摘要（由多階獎項自動產生） */
  prize: string;
  expiresAt: string;
  /** 總份數（等於各獎項份數加總） */
  quota: number;
  prizes: CampaignPrizeTier[];
  createdAt?: string;
};

export type DashboardStats = {
  todayViews: number;
  couponsIssued: number;
  totalLeads: number;
};

export type StoreSettings = {
  name: string;
  category: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  hours: string;
  address: string;
  mapUrl: string;
  lineUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  banner: string;
  accent: "emerald" | "rose" | "amber";
  announcement: string;
  welcomeMessage: string;
  showCampaign: boolean;
  showContactForm: boolean;
  showMapButton: boolean;
  showLineButton: boolean;
  products: StoreProduct[];
};

function themeToAccent(theme: StoreTheme): StoreProfile["accent"] {
  if (theme === "nail") return "rose";
  if (theme === "shop") return "amber";
  return "emerald";
}

function tenantToProfile(tenant: StoreTenant): StoreProfile {
  return {
    slug: tenant.slug,
    name: tenant.name,
    category: tenant.category,
    tagline: tenant.tagline,
    description: tenant.description,
    phone: tenant.phone,
    hours: tenant.hours,
    address: tenant.address,
    mapUrl: tenant.mapUrl,
    lineUrl: tenant.lineUrl,
    banner: tenant.banner,
    accent: themeToAccent(tenant.theme),
    theme: tenant.theme,
    announcement: tenant.announcement,
    welcomeMessage: tenant.welcomeMessage,
    showCampaign: tenant.showCampaign,
    showContactForm: tenant.showContactForm,
    products: tenant.products,
    campaign: tenant.campaign,
  };
}

/** 以新 slug 為主；同時保留舊 slug 鍵方便相容 */
export const STORES: Record<string, StoreProfile> = {
  "brunch-house": tenantToProfile(STORES_DB["brunch-house"]),
  "nail-studio": tenantToProfile(STORES_DB["nail-studio"]),
  "hair-salon": tenantToProfile(STORES_DB["hair-salon"]),
  "select-shop": tenantToProfile(STORES_DB["select-shop"]),
  "sample-cafe": tenantToProfile(STORES_DB["brunch-house"]),
  "sample-nail": tenantToProfile(STORES_DB["nail-studio"]),
  "sample-hair": tenantToProfile(STORES_DB["hair-salon"]),
};

const brunch = STORES["brunch-house"];

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  name: brunch.name,
  category: brunch.category,
  tagline: brunch.tagline,
  description: brunch.description,
  phone: brunch.phone,
  email: "hello@brunchhouse.tw",
  hours: brunch.hours,
  address: brunch.address,
  mapUrl: brunch.mapUrl,
  lineUrl: brunch.lineUrl,
  facebookUrl: "https://facebook.com/",
  instagramUrl: "https://instagram.com/",
  banner: brunch.banner,
  accent: brunch.accent,
  announcement: brunch.announcement,
  welcomeMessage: brunch.welcomeMessage,
  showCampaign: true,
  showContactForm: true,
  showMapButton: true,
  showLineButton: true,
  products: brunch.products,
};

export const DEFAULT_STATS: DashboardStats = {
  todayViews: 0,
  couponsIssued: 0,
  totalLeads: 0,
};

export const DEFAULT_LEADS: LeadRecord[] = [];

const defaultBeautyPrizes = buildDefaultBeautyPrizes();

export const DEFAULT_CAMPAIGN: CampaignDraft = {
  name: "開幕刮刮樂・美業回訪禮",
  prize: summarizePrizes(defaultBeautyPrizes),
  expiresAt: brunch.campaign.expiresAt,
  quota: defaultBeautyPrizes.reduce((sum, tier) => sum + tier.quantity, 0),
  prizes: defaultBeautyPrizes,
};

/** @deprecated 早午餐示範獎項；新活動請用 DEFAULT_CAMPAIGN／buildDefaultBeautyPrizes */
export const DEFAULT_BRUNCH_CAMPAIGN_PRIZES = brunch.campaign.prizes?.length
  ? brunch.campaign.prizes
  : buildDefaultBrunchPrizes();

export function getStoreProfile(slug: string): StoreProfile | null {
  const tenant = getStoreBySlug(slug);
  return tenant ? tenantToProfile(tenant) : null;
}
