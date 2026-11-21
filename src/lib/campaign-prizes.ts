export type CampaignPrizeTier = {
  id: string;
  label: string;
  quantity: number;
};

export type CampaignWithPrizes = {
  name: string;
  prize: string;
  expiresAt: string;
  quota: number;
  prizes: CampaignPrizeTier[];
  createdAt?: string;
};

export function createPrizeId() {
  return `prize-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 將舊版單獎品活動轉成多階獎項 */
export function normalizeCampaignPrizes(
  campaign: Partial<CampaignWithPrizes> & {
    name?: string;
    prize?: string;
    quota?: number;
  },
): CampaignPrizeTier[] {
  if (Array.isArray(campaign.prizes) && campaign.prizes.length > 0) {
    return campaign.prizes
      .map((tier, index) => ({
        id: tier.id || `prize-${index}`,
        label: (tier.label || "").trim() || `獎項 ${index + 1}`,
        quantity: Math.max(0, Math.floor(Number(tier.quantity) || 0)),
      }))
      .filter((tier) => tier.quantity > 0);
  }

  const quota = Math.max(1, Math.floor(Number(campaign.quota) || 1));
  const label = (campaign.prize || "").trim() || "活動優惠券";
  return [{ id: "prize-default", label, quantity: quota }];
}

export function totalPrizeQuantity(prizes: CampaignPrizeTier[]) {
  return prizes.reduce((sum, tier) => sum + Math.max(0, tier.quantity), 0);
}

export function summarizePrizes(prizes: CampaignPrizeTier[]) {
  if (prizes.length === 0) return "尚未設定獎項";
  return prizes.map((tier) => `${tier.quantity} 份${tier.label}`).join("、");
}

/** 依剩餘份數加權抽出一個獎項 */
export function pickWeightedPrize(
  prizes: CampaignPrizeTier[],
  remaining: Record<string, number>,
): CampaignPrizeTier | null {
  const pool: CampaignPrizeTier[] = [];
  for (const tier of prizes) {
    const left = remaining[tier.id] ?? tier.quantity;
    for (let i = 0; i < left; i += 1) {
      pool.push(tier);
    }
  }
  if (pool.length === 0) return null;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}

export function buildDefaultBrunchPrizes(): CampaignPrizeTier[] {
  return [
    { id: "tier-70", label: "全品項 7 折", quantity: 10 },
    { id: "tier-80", label: "全品項 8 折", quantity: 10 },
    { id: "tier-85", label: "全品項 85 折", quantity: 10 },
    { id: "tier-90", label: "全品項 9 折", quantity: 70 },
  ];
}

/** 美業／沙龍預設刮刮樂獎項（轉換率導向） */
export function buildDefaultBeautyPrizes(): CampaignPrizeTier[] {
  return [
    { id: "beauty-1", label: "一獎：現折 $100", quantity: 8 },
    { id: "beauty-2", label: "二獎：免費指緣油／深層保養體驗", quantity: 12 },
    { id: "beauty-3", label: "三獎：熟客 9 折券", quantity: 40 },
    { id: "beauty-4", label: "感謝獎：到店小禮一份", quantity: 40 },
  ];
}
