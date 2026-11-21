import { buildDefaultBeautyPrizes, summarizePrizes, totalPrizeQuantity } from "@/lib/campaign-prizes";
import type { StoreProduct } from "@/data/stores-db";

export type DemoTemplateId = "nail-lash" | "hair-salon";

export type DemoTemplate = {
  id: DemoTemplateId;
  label: string;
  description: string;
  category: string;
  tagline: string;
  descriptionBody: string;
  accent: "rose" | "amber" | "emerald";
  staffOptions: string[];
  products: StoreProduct[];
  campaignName: string;
};

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    id: "nail-lash",
    label: "美甲美睫工作室範本",
    description: "預設單色美甲、保養、造型項目與設計師選單",
    category: "美甲／美睫",
    tagline: "預約導流・刮刮樂留客・LINE 雙向通知",
    descriptionBody:
      "專業美甲美睫工作室示範前台：線上選項目與設計師、時段防重疊，完成預約後自動通知店家與行前提醒。",
    accent: "rose",
    staffOptions: ["不指定", "美甲師 A", "美睫師 B"],
    products: [
      {
        id: "svc-gel",
        name: "單色凝膠美甲",
        price: 799,
        description: "基礎保養＋單色凝膠，約 60–75 分",
        durationMinutes: 75,
        image:
          "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "svc-care",
        name: "深層指緣保養",
        price: 580,
        description: "去角質＋指緣油養護，約 40 分",
        durationMinutes: 40,
        image:
          "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "svc-art",
        name: "造型彩繪加價",
        price: 300,
        description: "手繪／貼鑽細節，依款式調整",
        durationMinutes: 30,
        image:
          "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "svc-lash",
        name: "自然款美睫嫁接",
        price: 1280,
        description: "自然濃密，約 90 分",
        durationMinutes: 90,
        image:
          "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80",
      },
    ],
    campaignName: "開幕刮刮樂・美甲美睫回訪禮",
  },
  {
    id: "hair-salon",
    label: "髮型沙龍工作室範本",
    description: "預設剪髮、染髮、護髮項目與時段",
    category: "美髮沙龍",
    tagline: "設計師排班・防重疊日曆・熟客回訪",
    descriptionBody:
      "髮型沙龍示範前台：指定設計師與服務項目，時段自動鎖定避免撞班，搭配刮刮樂提升回訪。",
    accent: "amber",
    staffOptions: ["不指定", "設計師小安", "設計師小雨"],
    products: [
      {
        id: "svc-cut",
        name: "剪髮造型",
        price: 680,
        description: "諮詢＋洗剪吹，約 60 分",
        durationMinutes: 60,
        image:
          "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "svc-color",
        name: "染髮（含護）",
        price: 2800,
        description: "染劑＋基礎護髮，約 150 分",
        durationMinutes: 150,
        tags: ["color"],
        image:
          "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "svc-perm-color",
        name: "燙染造型",
        price: 4200,
        description: "燙染一條龍，約 210 分（duration_minutes=210）",
        durationMinutes: 210,
        tags: ["perm", "color"],
        image:
          "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "svc-treat",
        name: "深層護髮",
        price: 1200,
        description: "結構修護＋造型吹整，約 75 分",
        durationMinutes: 75,
        image:
          "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=800&q=80",
      },
    ],
    campaignName: "沙龍開幕刮刮樂・回訪禮遇",
  },
];

export function getDemoTemplate(id: DemoTemplateId) {
  return DEMO_TEMPLATES.find((t) => t.id === id) || DEMO_TEMPLATES[0];
}

export function buildDemoCampaign(template: DemoTemplate) {
  const prizes = buildDefaultBeautyPrizes();
  return {
    name: template.campaignName,
    prize: summarizePrizes(prizes),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    quota: totalPrizeQuantity(prizes),
    prizes,
  };
}
