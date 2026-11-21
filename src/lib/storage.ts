"use client";

import {
  normalizeCampaignPrizes,
  pickWeightedPrize,
  summarizePrizes,
  totalPrizeQuantity,
  type CampaignPrizeTier,
} from "./campaign-prizes";
import {
  DEFAULT_CAMPAIGN,
  DEFAULT_LEADS,
  DEFAULT_STATS,
  DEFAULT_STORE_SETTINGS,
  type CampaignDraft,
  type DashboardStats,
  type LeadRecord,
  type StoreProduct,
  type StoreProfile,
  type StoreSettings,
  STORES,
} from "./mock-data";

const KEYS = {
  storeSettings: "taiwanbiz.storeSettings.v2",
  leads: "taiwanbiz.leads.v2",
  stats: "taiwanbiz.stats.v2",
  campaign: "taiwanbiz.campaign.v3",
  claimedPhones: "taiwanbiz.claimedPhones",
  contactSubmissions: "taiwanbiz.contactSubmissions.v2",
  prizeStock: "taiwanbiz.prizeStock.v1",
  members: "taiwanbiz.members.v1",
  memberSession: "taiwanbiz.memberSession.v1",
} as const;

const ACCENTS = new Set(["emerald", "rose", "amber"]);

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): boolean {
  if (!canUseStorage()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("taiwanbiz-storage"));
    return true;
  } catch {
    return false;
  }
}

function normalizeAccent(
  value: unknown,
  fallback: StoreSettings["accent"],
): StoreSettings["accent"] {
  if (typeof value === "string" && ACCENTS.has(value)) {
    return value as StoreSettings["accent"];
  }
  return fallback;
}

export type { StoreSettings };

export function getStoreSettings(): StoreSettings {
  const saved = readJson<Partial<StoreSettings>>(KEYS.storeSettings, {});
  const products =
    Array.isArray(saved.products) && saved.products.length > 0
      ? saved.products
      : DEFAULT_STORE_SETTINGS.products;

  return {
    ...DEFAULT_STORE_SETTINGS,
    ...saved,
    accent: normalizeAccent(saved.accent, DEFAULT_STORE_SETTINGS.accent),
    products,
    showCampaign: saved.showCampaign ?? DEFAULT_STORE_SETTINGS.showCampaign,
    showContactForm:
      saved.showContactForm ?? DEFAULT_STORE_SETTINGS.showContactForm,
    showMapButton: saved.showMapButton ?? DEFAULT_STORE_SETTINGS.showMapButton,
    showLineButton:
      saved.showLineButton ?? DEFAULT_STORE_SETTINGS.showLineButton,
  };
}

export function saveStoreSettings(settings: StoreSettings) {
  const next: StoreSettings = {
    ...settings,
    accent: normalizeAccent(settings.accent, DEFAULT_STORE_SETTINGS.accent),
  };
  return writeJson(KEYS.storeSettings, next);
}

export function saveStoreProducts(products: StoreProduct[]) {
  const current = getStoreSettings();
  return saveStoreSettings({ ...current, products });
}

function accentToTheme(
  accent: StoreSettings["accent"],
  fallback: StoreProfile["theme"],
): StoreProfile["theme"] {
  if (accent === "rose") return "nail";
  if (accent === "amber" || accent === "emerald") return "brunch";
  return fallback;
}

export function settingsToStoreProfile(
  settings: StoreSettings,
  slug = "brunch-house",
): StoreProfile {
  const base = STORES[slug] ?? STORES["brunch-house"];
  const accent = normalizeAccent(settings.accent, base.accent);
  return {
    ...base,
    slug,
    name: settings.name,
    category: settings.category,
    tagline: settings.tagline,
    description: settings.description,
    phone: settings.phone,
    hours: settings.hours,
    address: settings.address,
    mapUrl: settings.mapUrl,
    lineUrl: settings.lineUrl,
    banner: settings.banner,
    accent,
    theme: accentToTheme(accent, base.theme),
    announcement: settings.announcement || base.announcement,
    welcomeMessage: settings.welcomeMessage || base.welcomeMessage,
    showCampaign: settings.showCampaign,
    showContactForm: settings.showContactForm,
    products: settings.products,
    campaign: base.campaign,
  };
}

export function getLeads(): LeadRecord[] {
  return readJson(KEYS.leads, DEFAULT_LEADS);
}

export function saveLeads(leads: LeadRecord[]) {
  return writeJson(KEYS.leads, leads);
}

export function updateLeadStatus(id: string, status: LeadRecord["status"]) {
  const leads = getLeads().map((lead) =>
    lead.id === id ? { ...lead, status } : lead,
  );
  const ok = saveLeads(leads);
  return { leads: ok ? leads : getLeads(), ok };
}

export function addLead(lead: LeadRecord) {
  const leads = getLeads();
  if (leads.some((item) => item.couponCode === lead.couponCode)) {
    return { leads, ok: true as const };
  }
  const next = [lead, ...leads];
  const saved = saveLeads(next);
  if (!saved) return { leads, ok: false as const };

  const stats = getStats();
  saveStats({
    ...stats,
    couponsIssued: stats.couponsIssued + 1,
    totalLeads: Math.max(stats.totalLeads + 1, next.length),
  });

  return { leads: next, ok: true as const };
}

export function getStats(): DashboardStats {
  return readJson(KEYS.stats, DEFAULT_STATS);
}

export function saveStats(stats: DashboardStats) {
  return writeJson(KEYS.stats, stats);
}

export function normalizeCampaign(
  input: Partial<CampaignDraft> | null | undefined,
  fallback: CampaignDraft = DEFAULT_CAMPAIGN,
): CampaignDraft {
  const merged = { ...fallback, ...(input || {}) };
  const prizes = normalizeCampaignPrizes(merged);
  const quota = totalPrizeQuantity(prizes);
  return {
    name: (merged.name || fallback.name).trim() || fallback.name,
    prize: summarizePrizes(prizes),
    expiresAt: merged.expiresAt || fallback.expiresAt,
    quota: quota > 0 ? quota : fallback.quota,
    prizes: prizes.length > 0 ? prizes : fallback.prizes,
    createdAt: merged.createdAt,
  };
}

/** 僅在 localStorage 真有活動資料時回傳；否則 null（讓前台改用店家 DB 活動） */
export function readSavedCampaign(): CampaignDraft | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(KEYS.campaign);
    if (!raw) return null;
    return normalizeCampaign(JSON.parse(raw) as Partial<CampaignDraft>);
  } catch {
    return null;
  }
}

export function getCampaign(): CampaignDraft {
  return readSavedCampaign() ?? normalizeCampaign({}, DEFAULT_CAMPAIGN);
}

export function saveCampaign(campaign: CampaignDraft, storeSlug = "brunch-house") {
  const next = normalizeCampaign(campaign);
  const payload = {
    ...next,
    createdAt: next.createdAt ?? new Date().toISOString(),
  };
  const ok = writeJson(KEYS.campaign, payload);
  if (ok) {
    resetPrizeStock(storeSlug, next.prizes);
  }
  return ok;
}

type PrizeStockMap = Record<string, Record<string, number>>;

function getPrizeStockMap(): PrizeStockMap {
  return readJson<PrizeStockMap>(KEYS.prizeStock, {});
}

export function resetPrizeStock(storeSlug: string, prizes: CampaignPrizeTier[]) {
  const map = getPrizeStockMap();
  map[storeSlug] = Object.fromEntries(
    prizes.map((tier) => [tier.id, tier.quantity]),
  );
  return writeJson(KEYS.prizeStock, map);
}

export function ensurePrizeStock(
  storeSlug: string,
  prizes: CampaignPrizeTier[],
): Record<string, number> {
  const map = getPrizeStockMap();
  const current = map[storeSlug] ?? {};
  const next: Record<string, number> = {};
  let changed = !map[storeSlug];

  for (const tier of prizes) {
    if (typeof current[tier.id] === "number") {
      // 保留已消耗庫存，並以目前設定上限夾住
      const capped = Math.max(0, Math.min(tier.quantity, current[tier.id]));
      next[tier.id] = capped;
      if (capped !== current[tier.id]) changed = true;
    } else {
      next[tier.id] = tier.quantity;
      changed = true;
    }
  }

  for (const id of Object.keys(current)) {
    if (!(id in next)) {
      changed = true;
      break;
    }
  }

  if (changed) {
    map[storeSlug] = next;
    writeJson(KEYS.prizeStock, map);
  }
  return next;
}

export function getPrizeStockSummary(
  storeSlug: string,
  campaign: CampaignDraft,
) {
  const remaining = ensurePrizeStock(storeSlug, campaign.prizes);
  return campaign.prizes.map((tier) => ({
    ...tier,
    remaining: Math.max(0, remaining[tier.id] ?? tier.quantity),
  }));
}

export function drawCampaignPrize(
  storeSlug: string,
  campaign: CampaignDraft,
): { tier: CampaignPrizeTier; remainingTotal: number } | null {
  const normalized = normalizeCampaign(campaign);
  const remaining = { ...ensurePrizeStock(storeSlug, normalized.prizes) };
  const tier = pickWeightedPrize(normalized.prizes, remaining);
  if (!tier) return null;
  return consumePrizeTier(storeSlug, campaign, tier.id);
}

/** 刮開時預覽獎項（不扣庫存），領取時再 consume */
export function peekCampaignPrize(
  storeSlug: string,
  campaign: CampaignDraft,
): CampaignPrizeTier | null {
  const normalized = normalizeCampaign(campaign);
  const remaining = ensurePrizeStock(storeSlug, normalized.prizes);
  return pickWeightedPrize(normalized.prizes, remaining);
}

export function consumePrizeTier(
  storeSlug: string,
  campaign: CampaignDraft,
  tierId: string,
): { tier: CampaignPrizeTier; remainingTotal: number } | null {
  const normalized = normalizeCampaign(campaign);
  const tier = normalized.prizes.find((item) => item.id === tierId);
  if (!tier) return null;

  const remaining = { ...ensurePrizeStock(storeSlug, normalized.prizes) };
  const left = remaining[tierId] ?? 0;
  if (left <= 0) return null;

  remaining[tierId] = left - 1;
  const map = getPrizeStockMap();
  map[storeSlug] = remaining;
  if (!writeJson(KEYS.prizeStock, map)) return null;

  const remainingTotal = Object.values(remaining).reduce(
    (sum, value) => sum + Math.max(0, value),
    0,
  );
  return { tier, remainingTotal };
}

export function isCampaignActive(
  campaign = getCampaign(),
  storeSlug = "brunch-house",
) {
  const normalized = normalizeCampaign(campaign);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (normalized.expiresAt) {
    const expires = new Date(`${normalized.expiresAt}T23:59:59`);
    if (!Number.isNaN(expires.getTime()) && today > expires) {
      return { ok: false as const, reason: "活動已截止，感謝您的參與。" };
    }
  }
  const remaining = ensurePrizeStock(storeSlug, normalized.prizes);
  const left = Object.values(remaining).reduce(
    (sum, value) => sum + Math.max(0, value),
    0,
  );
  if (left <= 0) {
    return { ok: false as const, reason: "本活動優惠券已發放完畢。" };
  }
  return { ok: true as const };
}

export function getClaimedPhones(storeSlug: string): string[] {
  const map = readJson<Record<string, string[]>>(KEYS.claimedPhones, {});
  return map[storeSlug] ?? [];
}

export function markPhoneClaimed(storeSlug: string, phone: string) {
  const map = readJson<Record<string, string[]>>(KEYS.claimedPhones, {});
  const current = new Set(map[storeSlug] ?? []);
  current.add(phone);
  map[storeSlug] = Array.from(current);
  return writeJson(KEYS.claimedPhones, map);
}

export function unclaimPhone(storeSlug: string, phone: string) {
  const map = readJson<Record<string, string[]>>(KEYS.claimedPhones, {});
  const current = (map[storeSlug] ?? []).filter((item) => item !== phone);
  map[storeSlug] = current;
  return writeJson(KEYS.claimedPhones, map);
}

/** 抽獎後若後續寫入失敗，回補該獎項庫存 */
export function restorePrizeTier(
  storeSlug: string,
  campaign: CampaignDraft,
  tierId: string,
) {
  const normalized = normalizeCampaign(campaign);
  const tier = normalized.prizes.find((item) => item.id === tierId);
  if (!tier) return false;
  const remaining = { ...ensurePrizeStock(storeSlug, normalized.prizes) };
  remaining[tierId] = Math.min(
    tier.quantity,
    Math.max(0, (remaining[tierId] ?? 0) + 1),
  );
  const map = getPrizeStockMap();
  map[storeSlug] = remaining;
  return writeJson(KEYS.prizeStock, map);
}

export function hasPhoneClaimed(storeSlug: string, phone: string) {
  return getClaimedPhones(storeSlug).includes(phone);
}

export type ContactSubmission = {
  id: string;
  name: string;
  phone: string;
  message: string;
  storeName?: string;
  createdAt: string;
};

export function saveContactSubmission(
  submission: Omit<ContactSubmission, "id" | "createdAt">,
) {
  const list = readJson<ContactSubmission[]>(KEYS.contactSubmissions, []);
  const next: ContactSubmission = {
    ...submission,
    id: `contact-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const ok = writeJson(KEYS.contactSubmissions, [next, ...list]);
  return ok ? next : null;
}

export function getContactSubmissions(): ContactSubmission[] {
  return readJson(KEYS.contactSubmissions, []);
}

export type StoreMember = {
  phone: string;
  joinedAt: string;
  welcomeCouponCode: string;
};

type MemberMap = Record<string, StoreMember[]>;
type MemberSessionMap = Record<string, string>;

export function getStoreMembers(storeSlug: string): StoreMember[] {
  const map = readJson<MemberMap>(KEYS.members, {});
  return map[storeSlug] ?? [];
}

export function getMemberSession(storeSlug: string): string | null {
  const map = readJson<MemberSessionMap>(KEYS.memberSession, {});
  return map[storeSlug] ?? null;
}

export function clearMemberSession(storeSlug: string) {
  const map = readJson<MemberSessionMap>(KEYS.memberSession, {});
  delete map[storeSlug];
  return writeJson(KEYS.memberSession, map);
}

export function upsertStoreMember(
  storeSlug: string,
  phone: string,
): { member: StoreMember; created: boolean; ok: boolean } {
  const map = readJson<MemberMap>(KEYS.members, {});
  const list = map[storeSlug] ?? [];
  const existing = list.find((item) => item.phone === phone);
  if (existing) {
    const sessions = readJson<MemberSessionMap>(KEYS.memberSession, {});
    sessions[storeSlug] = phone;
    const ok = writeJson(KEYS.memberSession, sessions);
    return {
      member: existing,
      created: false,
      ok,
    };
  }

  const member: StoreMember = {
    phone,
    joinedAt: new Date().toISOString(),
    welcomeCouponCode: `WELCOME-${phone.slice(-4)}`,
  };
  map[storeSlug] = [member, ...list];
  const savedMembers = writeJson(KEYS.members, map);
  const sessions = readJson<MemberSessionMap>(KEYS.memberSession, {});
  sessions[storeSlug] = phone;
  const savedSession = writeJson(KEYS.memberSession, sessions);
  return { member, created: true, ok: savedMembers && savedSession };
}

export function getLoggedInMember(storeSlug: string): StoreMember | null {
  const phone = getMemberSession(storeSlug);
  if (!phone) return null;
  return (
    getStoreMembers(storeSlug).find((item) => item.phone === phone) ?? null
  );
}
