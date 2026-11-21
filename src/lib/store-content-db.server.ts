import type { StoreTenant } from "@/data/stores-db";
import { getStoreBySlug } from "@/data/stores-db";
import {
  emptyPayout,
  emptyShipping,
  normalizeShippingSettings,
  type StoreContentRecord,
} from "@/lib/store-content";
import {
  defaultBusinessHours,
  normalizeBusinessHours,
} from "@/lib/business-hours";
import { normalizeShopPromos } from "@/lib/shop-promos";
import { buildProvisionedStore } from "@/lib/provisioned-store";
import { normalizeStoreStyle } from "@/lib/store-style";
import {
  getTenantDbByStoreId,
  listTenantDb,
} from "@/lib/tenant-db.server";
import type { StoreSettings } from "@/lib/mock-data";
import { get } from "@vercel/blob";
import { put } from "@vercel/blob";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data", "stores");

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function blobPath(slug: string) {
  return `taiwanbiz/stores/${slug.trim().toLowerCase()}.json`;
}

function diskPath(slug: string) {
  return path.join(DATA_DIR, `${slug.trim().toLowerCase()}.json`);
}

function ensureDir() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

type GlobalStore = {
  __taiwanbizStoreContent?: Map<string, StoreContentRecord>;
  __taiwanbizStoreWriteChain?: Map<string, Promise<void>>;
};

function globalStore() {
  return globalThis as typeof globalThis & GlobalStore;
}

function cache() {
  const g = globalStore();
  if (!g.__taiwanbizStoreContent) g.__taiwanbizStoreContent = new Map();
  return g.__taiwanbizStoreContent;
}

function writeChain() {
  const g = globalStore();
  if (!g.__taiwanbizStoreWriteChain) g.__taiwanbizStoreWriteChain = new Map();
  return g.__taiwanbizStoreWriteChain;
}

function themeFromSettings(settings: StoreSettings): StoreContentRecord["theme"] {
  if (settings.accent === "rose") return "nail";
  if (settings.accent === "amber") return "shop";
  return "brunch";
}

export function storeTenantFromContent(
  content: StoreContentRecord,
): StoreTenant {
  return {
    slug: content.slug,
    name: content.profile.name,
    category: content.profile.category,
    tagline: content.profile.tagline,
    description: content.profile.description,
    phone: content.profile.phone,
    hours: content.profile.hours,
    address: content.profile.address,
    mapUrl: content.profile.mapUrl,
    lineUrl: content.profile.lineUrl,
    banner: content.profile.banner,
    theme: content.theme,
    mode: content.mode,
    announcement: content.profile.announcement,
    welcomeMessage: content.profile.welcomeMessage,
    showCampaign: content.profile.showCampaign,
    showContactForm: content.profile.showContactForm,
    products: content.profile.products,
    shopProducts: content.shopProducts,
    campaign: content.campaign,
  };
}

function contentFromStatic(slug: string): StoreContentRecord | null {
  const staticStore = getStoreBySlug(slug);
  if (!staticStore) return null;
  const accent =
    staticStore.theme === "nail"
      ? "rose"
      : staticStore.theme === "shop"
        ? "amber"
        : "emerald";
  return {
    slug: staticStore.slug,
    updatedAt: new Date().toISOString(),
    mode: staticStore.mode || "service",
    theme: staticStore.theme,
    profile: {
      name: staticStore.name,
      category: staticStore.category,
      tagline: staticStore.tagline,
      description: staticStore.description,
      phone: staticStore.phone,
      email: "",
      hours: staticStore.hours,
      address: staticStore.address,
      mapUrl: staticStore.mapUrl,
      lineUrl: staticStore.lineUrl,
      facebookUrl: "",
      instagramUrl: "",
      banner: staticStore.banner,
      accent,
      announcement: staticStore.announcement,
      welcomeMessage: staticStore.welcomeMessage,
      showCampaign: staticStore.showCampaign,
      showContactForm: staticStore.showContactForm,
      showMapButton: true,
      showLineButton: true,
      products: staticStore.products,
    },
    shopProducts: staticStore.shopProducts || [],
    campaign: staticStore.campaign,
    shopPromos: [],
    leads: [],
    prizeStock: {},
    claimedPhones: [],
    contactSubmissions: [],
    businessHours: defaultBusinessHours(),
    payout: emptyPayout(),
    shipping: emptyShipping(),
    bookingTerms:
      staticStore.slug === "nail-studio" || staticStore.slug === "hair-salon"
        ? "預約成立後請準時到店；遲到超過 15 分鐘視同放棄，需重新預約。到店請出示預約簡訊或 LINE 通知。"
        : undefined,
    storefrontPreset:
      staticStore.slug === "nail-studio"
        ? "basic"
        : staticStore.slug === "hair-salon"
          ? "premium"
          : undefined,
    staff:
      staticStore.slug === "hair-salon"
        ? [
            {
              id: "st-owner",
              name: "設計師小安",
              isOwner: true,
              role: "stylist",
              active: true,
            },
            {
              id: "st-2",
              name: "設計師小雨",
              role: "stylist",
              active: true,
            },
          ]
        : staticStore.slug === "nail-studio"
          ? [
              {
                id: "st-nail-a",
                name: "美甲師 A",
                isOwner: true,
                role: "stylist",
                active: true,
              },
              {
                id: "st-lash-b",
                name: "美睫師 B",
                role: "stylist",
                active: true,
              },
            ]
          : undefined,
    offPeakDiscount:
      staticStore.slug === "hair-salon"
        ? {
            enabled: true,
            weekdays: ["tue", "wed", "thu"],
            start: "13:00",
            end: "16:00",
            mode: "fixed",
            fixedAmount: 100,
            percentOff: 10,
            promoCode: "OFFPEAK100",
          }
        : undefined,
  };
}

function contentFromTenant(slug: string, built: StoreTenant): StoreContentRecord {
  const accent =
    built.theme === "nail"
      ? "rose"
      : built.theme === "shop"
        ? "amber"
        : "emerald";
  return {
    slug: built.slug,
    updatedAt: new Date().toISOString(),
    mode: built.mode || "service",
    theme: built.theme,
    profile: {
      name: built.name,
      category: built.category,
      tagline: built.tagline,
      description: built.description,
      phone: built.phone,
      email: "",
      hours: built.hours,
      address: built.address,
      mapUrl: built.mapUrl,
      lineUrl: built.lineUrl,
      facebookUrl: "",
      instagramUrl: "",
      banner: built.banner,
      accent,
      announcement: built.announcement,
      welcomeMessage: built.welcomeMessage,
      showCampaign: built.showCampaign,
      showContactForm: built.showContactForm,
      showMapButton: true,
      showLineButton: true,
      products: built.products,
    },
    shopProducts: built.shopProducts || [],
    campaign: built.campaign,
    shopPromos: [],
    leads: [],
    prizeStock: {},
    claimedPhones: [],
    contactSubmissions: [],
    businessHours: defaultBusinessHours(),
    payout: emptyPayout(),
    shipping: emptyShipping(),
  };
}

async function readFromBlob(slug: string): Promise<StoreContentRecord | null> {
  if (!blobConfigured()) return null;
  try {
    const result = await get(blobPath(slug), {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const parsed = JSON.parse(
      await new Response(result.stream).text(),
    ) as StoreContentRecord;
    if (!parsed?.slug) return null;
    return normalizeContent(parsed);
  } catch {
    return null;
  }
}

function readFromDisk(slug: string): StoreContentRecord | null {
  try {
    const file = diskPath(slug);
    if (!existsSync(file)) return null;
    return normalizeContent(
      JSON.parse(readFileSync(file, "utf8")) as StoreContentRecord,
    );
  } catch {
    return null;
  }
}

function writeToDisk(content: StoreContentRecord) {
  try {
    ensureDir();
    writeFileSync(diskPath(content.slug), JSON.stringify(content, null, 2), "utf8");
  } catch {
    // ignore
  }
}

async function writeToBlob(content: StoreContentRecord) {
  if (!blobConfigured()) return;
  await put(blobPath(content.slug), JSON.stringify(content, null, 2), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
}

function normalizeContent(raw: StoreContentRecord): StoreContentRecord {
  return {
    ...raw,
    slug: raw.slug.trim().toLowerCase(),
    payout: { ...emptyPayout(), ...(raw.payout || {}) },
    shipping: normalizeShippingSettings(raw.shipping),
    shopPromos: normalizeShopPromos(raw.shopPromos),
    shopProducts: Array.isArray(raw.shopProducts) ? raw.shopProducts : [],
    leads: Array.isArray(raw.leads) ? raw.leads : [],
    claimedPhones: Array.isArray(raw.claimedPhones) ? raw.claimedPhones : [],
    contactSubmissions: Array.isArray(raw.contactSubmissions)
      ? raw.contactSubmissions
      : [],
    prizeStock: raw.prizeStock || {},
    bookingTerms: raw.bookingTerms,
    storefrontPreset:
      raw.storefrontPreset === "basic" || raw.storefrontPreset === "premium"
        ? raw.storefrontPreset
        : undefined,
    staff: Array.isArray(raw.staff) ? raw.staff : undefined,
    blacklists: Array.isArray(raw.blacklists) ? raw.blacklists : undefined,
    customers: Array.isArray(raw.customers) ? raw.customers : undefined,
    depositSettings: raw.depositSettings,
    storeStyle: raw.storeStyle,
    careRetargeting: raw.careRetargeting,
    offPeakDiscount: raw.offPeakDiscount,
    reviewUrl: raw.reviewUrl,
    reviewIgHint: raw.reviewIgHint,
  };
}

async function persist(content: StoreContentRecord) {
  const next = normalizeContent({
    ...content,
    updatedAt: new Date().toISOString(),
  });
  cache().set(next.slug, next);
  writeToDisk(next);

  const chains = writeChain();
  const prev = chains.get(next.slug) ?? Promise.resolve();
  const job = prev
    .catch(() => undefined)
    .then(async () => {
      await writeToBlob(next);
    });
  chains.set(next.slug, job);
  try {
    await job;
  } catch {
    // keep memory/disk
  }
  return next;
}

/** 讀取店家內容：Blob → disk → 靜態案例 → 租戶開通預設 */
export async function getStoreContent(
  slug: string,
): Promise<StoreContentRecord | null> {
  const key = slug.trim().toLowerCase();
  if (!key) return null;

  // Blob 為跨 instance 真實來源；不可先回記憶體快取，否則賣家更新／優惠設定會卡在舊資料
  if (blobConfigured()) {
    const fromBlob = await readFromBlob(key);
    if (fromBlob) {
      cache().set(key, fromBlob);
      return fromBlob;
    }
  }

  const hit = cache().get(key);
  if (hit) return hit;

  const fromDisk = readFromDisk(key);
  if (fromDisk) {
    cache().set(key, fromDisk);
    return fromDisk;
  }

  const fromStatic = contentFromStatic(key);
  if (fromStatic) {
    const saved = await persist(fromStatic);
    return saved;
  }

  const tenant = await getTenantDbByStoreId(key);
  if (tenant) {
    const built = buildProvisionedStore(tenant);
    const seeded = contentFromTenant(key, built);
    if (tenant.ownerEmail) {
      seeded.profile.email = tenant.ownerEmail;
    }
    const { resolveStorefrontPreset } = await import("@/lib/storefront-preset");
    seeded.storefrontPreset = resolveStorefrontPreset({
      slug: key,
      planName: tenant.planName,
      listAmount: tenant.listAmount,
    });
    return persist(seeded);
  }

  return null;
}

export async function saveStoreContent(
  content: StoreContentRecord,
): Promise<StoreContentRecord> {
  return persist(content);
}

export async function patchStoreContent(
  slug: string,
  patch: Partial<StoreContentRecord> & {
    profile?: Partial<StoreSettings>;
  },
): Promise<StoreContentRecord | null> {
  const current = await getStoreContent(slug);
  if (!current) return null;
  const next: StoreContentRecord = {
    ...current,
    ...patch,
    slug: current.slug,
    profile: {
      ...current.profile,
      ...(patch.profile || {}),
    },
    payout: {
      ...current.payout,
      ...(patch.payout || {}),
    },
    shipping: normalizeShippingSettings({
      ...current.shipping,
      ...(patch.shipping || {}),
    }),
    businessHours: normalizeBusinessHours(
      patch.businessHours !== undefined
        ? patch.businessHours
        : current.businessHours,
    ),
    shopPromos:
      patch.shopPromos !== undefined
        ? normalizeShopPromos(patch.shopPromos)
        : current.shopPromos || [],
    theme: patch.theme || themeFromSettings({
      ...current.profile,
      ...(patch.profile || {}),
    }),
    storeStyle:
      patch.storeStyle !== undefined
        ? normalizeStoreStyle(
            patch.storeStyle,
            patch.profile?.accent || current.profile.accent,
          )
        : current.storeStyle,
  };
  return persist(next);
}

export async function listStoreContentsForOwner(email: string) {
  const normalized = email.trim().toLowerCase();
  const tenants = await listTenantDb();
  const owned = tenants.filter(
    (t) => t.ownerEmail.trim().toLowerCase() === normalized,
  );
  const contents: StoreContentRecord[] = [];
  for (const t of owned) {
    const c = await getStoreContent(t.slug);
    if (c) contents.push(c);
  }
  return contents;
}

export async function ensureStoreContentForTenant(slug: string) {
  const content = await getStoreContent(slug);
  if (!content) return null;
  // 依訂閱方案鎖定前台 preset（基礎版＝純預約；旗艦＝品牌官網）
  const tenant = await getTenantDbByStoreId(slug);
  if (!tenant) return content;
  const { resolveStorefrontPreset } = await import("@/lib/storefront-preset");
  const preset = resolveStorefrontPreset({
    slug,
    planName: tenant.planName,
    listAmount: tenant.listAmount,
    override: content.storefrontPreset,
  });
  // 新建內容尚未覆寫時，依方案寫入 preset，確保基礎版試用前台正確
  if (!content.storefrontPreset && preset) {
    return patchStoreContent(slug, { storefrontPreset: preset });
  }
  return content;
}
