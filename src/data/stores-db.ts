/**
 * 多租戶店家「模擬資料庫」
 * 正式環境可替換為 Prisma / Supabase / PostgreSQL 查詢。
 */

export type StoreProduct = {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  /** 服務時長（分鐘），用於預約防重疊 */
  durationMinutes?: number;
  /**
   * 服務標籤：perm／color／燙髮／染髮 等
   * 用於燙染後自動護理推播
   */
  tags?: string[];
};

export type StoreCampaignPrize = {
  id: string;
  label: string;
  quantity: number;
};

export type StoreCampaign = {
  name: string;
  prize: string;
  expiresAt: string;
  quota: number;
  prizes: StoreCampaignPrize[];
};

/** 視覺主題：影響深色頁面的強調色 */
export type StoreTheme = "brunch" | "nail" | "shop";

/** 店家營運模式：服務預約 vs 微型電商 */
export type StoreMode = "service" | "shop";

export type ShopStockStatus = "in_stock" | "preorder";

export type ShopProductColor = {
  id: string;
  name: string;
  /** CSS 色碼，供色票顯示 */
  swatch: string;
};

/** 網拍／選物店商品（含尺寸、顏色與現貨狀態） */
export type ShopProduct = {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  stockStatus: ShopStockStatus;
  sizes: string[];
  colors: ShopProductColor[];
};

export type StoreTenant = {
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
  theme: StoreTheme;
  /** 預設 service；shop 走微型電商模板 */
  mode?: StoreMode;
  announcement: string;
  welcomeMessage: string;
  showCampaign: boolean;
  showContactForm: boolean;
  products: StoreProduct[];
  /** mode=shop 時使用 */
  shopProducts?: ShopProduct[];
  campaign: StoreCampaign;
};

/** slug → 店家完整資料（含營業資訊、商品、優惠券活動） */
export const STORES_DB: Record<string, StoreTenant> = {
  "brunch-house": {
    slug: "brunch-house",
    name: "巷弄晨光 Brunch House",
    category: "早午餐・咖啡廳",
    tagline: "用慢節奏迎接每一個台灣早晨",
    description:
      "藏身台中巷弄的社區早午餐咖啡廳，堅持單品手沖與在地烘焙麵包。無論是晨間會議或週末 Brunch，都能在這裡找到放鬆節奏。",
    phone: "04-2321-8899",
    hours: "週一至週日 08:00 – 18:00",
    address: "台中市西區民生路 128 巷 6 號",
    mapUrl: "https://maps.google.com/?q=台中市西區民生路128巷6號",
    lineUrl: "https://line.me/R/ti/p/@morninglight",
    banner:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1800&q=80",
    theme: "brunch",
    announcement: "平日 14:00 前點餐，手沖升級加購折 20 元。",
    welcomeMessage: "歡迎光臨！現場可參加限時刮刮樂領取優惠券。",
    showCampaign: true,
    showContactForm: true,
    products: [
      {
        id: "latte",
        name: "莊園拿鐵",
        price: 140,
        description: "台灣小農鮮奶搭配中焙豆，口感順滑帶堅果香。",
        image:
          "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "brunch",
        name: "巷弄早午餐盤",
        price: 280,
        description: "水波蛋、烤蔬與自製酸種吐司，一次滿足。",
        image:
          "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "toast",
        name: "蜂蜜起司厚片",
        price: 120,
        description: "外酥內軟，搭配在地龍眼蜜與乳酪。",
        image:
          "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "filter",
        name: "單品手沖",
        price: 160,
        description: "每日精選產區，現場手沖萃取花香與果酸。",
        image:
          "https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=900&q=80",
      },
    ],
    campaign: {
      name: "限時開幕刮刮樂",
      prize: "10 份 7 折、10 份 8 折、10 份 85 折、其餘 9 折",
      expiresAt: "2026-12-31",
      quota: 100,
      prizes: [
        { id: "brunch-70", label: "全品項 7 折", quantity: 10 },
        { id: "brunch-80", label: "全品項 8 折", quantity: 10 },
        { id: "brunch-85", label: "全品項 85 折", quantity: 10 },
        { id: "brunch-90", label: "全品項 9 折", quantity: 70 },
      ],
    },
  },
  "nail-studio": {
    slug: "nail-studio",
    name: "澄光美甲 Nail Studio",
    category: "質感美甲・護理",
    tagline: "為雙手換上日常的小確幸",
    description:
      "位於台北大安的預約制美甲工作室，強調低敏材質與細緻彩繪，適合忙碌都會女性的質感保養時光。",
    phone: "02-2708-5566",
    hours: "週二至週日 11:00 – 20:00（週一公休）",
    address: "台北市大安區仁愛路四段 48 號 3 樓",
    mapUrl: "https://maps.google.com/?q=台北市大安區仁愛路四段48號",
    lineUrl: "https://line.me/R/ti/p/@chengguang",
    banner:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1800&q=80",
    theme: "nail",
    announcement: "首次體驗享基礎凝膠折 150 元，請先透過 LINE 預約。",
    welcomeMessage: "預約制工作室，到店前可先領取首次體驗優惠券。",
    showCampaign: true,
    showContactForm: true,
    products: [
      {
        id: "gel",
        name: "單色凝膠",
        price: 799,
        description: "基礎保養＋單色凝膠，約 75 分鐘。",
        durationMinutes: 75,
        image:
          "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "art",
        name: "造型彩繪",
        price: 1099,
        description: "手繪／貼鑽造型，約 105 分鐘。",
        durationMinutes: 105,
        image:
          "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "care",
        name: "深層指緣護理",
        price: 680,
        description: "軟化、修整與保濕，約 40 分鐘。",
        durationMinutes: 40,
        image:
          "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "remove",
        name: "卸甲加購",
        price: 200,
        description: "溫和卸除舊凝膠，另加 30 分鐘。",
        durationMinutes: 30,
        image:
          "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=80",
      },
    ],
    campaign: {
      name: "限時開幕刮刮樂",
      prize: "一獎現折 $100、二獎免費指緣油／深層保養體驗、三獎熟客 9 折券",
      expiresAt: "2026-12-31",
      quota: 100,
      prizes: [
        { id: "beauty-1", label: "一獎：現折 $100", quantity: 8 },
        { id: "beauty-2", label: "二獎：免費指緣油／深層保養體驗", quantity: 12 },
        { id: "beauty-3", label: "三獎：熟客 9 折券", quantity: 40 },
        { id: "beauty-4", label: "感謝獎：到店小禮一份", quantity: 40 },
      ],
    },
  },
  "hair-salon": {
    slug: "hair-salon",
    name: "絲光髮廊 Silk Hair",
    category: "美髮沙龍・燙染",
    tagline: "剪燙染護・長時段防撞・離峰自動折扣",
    description:
      "預約制美髮沙龍示範站：剪髮／燙染選項、210 分鐘燙染時段鎖定、平日離峰自動折抵，適合一人工作室到多設計師沙龍。",
    phone: "02-2771-8800",
    hours: "週二至週日 11:00 – 20:00（週一公休）",
    address: "台北市松山區南京東路四段 50 號 2 樓",
    mapUrl: "https://maps.google.com/?q=台北市松山區南京東路四段50號",
    lineUrl: "https://line.me/R/ti/p/@silkhair",
    banner:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1800&q=80",
    theme: "nail",
    mode: "service",
    announcement: "平日 13:00–16:00 離峰時段自動折 $100（優惠碼 OFFPEAK100）。",
    welcomeMessage: "請先選擇服務與設計師；燙染將鎖定連續 210 分鐘空檔。",
    showCampaign: true,
    showContactForm: true,
    products: [
      {
        id: "cut",
        name: "剪髮造型",
        price: 680,
        description: "諮詢＋洗剪吹，約 60 分鐘。",
        durationMinutes: 60,
        image:
          "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "color",
        name: "染髮（含護）",
        price: 2800,
        description: "染劑＋基礎護髮，約 150 分鐘。",
        durationMinutes: 150,
        tags: ["color"],
        image:
          "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "perm-color",
        name: "燙染造型",
        price: 4200,
        description: "燙染一條龍，約 210 分鐘連續鎖定。",
        durationMinutes: 210,
        tags: ["perm", "color"],
        image:
          "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "treat",
        name: "深層護髮",
        price: 1200,
        description: "結構修護＋造型吹整，約 75 分鐘。",
        durationMinutes: 75,
        image:
          "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80",
      },
    ],
    campaign: {
      name: "沙龍開幕刮刮樂",
      prize: "一獎現折 $100、二獎深層護髮體驗、三獎熟客 9 折券",
      expiresAt: "2026-12-31",
      quota: 100,
      prizes: [
        { id: "hair-1", label: "一獎：現折 $100", quantity: 8 },
        { id: "hair-2", label: "二獎：深層護髮體驗", quantity: 12 },
        { id: "hair-3", label: "三獎：熟客 9 折券", quantity: 40 },
        { id: "hair-4", label: "感謝獎：到店小禮一份", quantity: 40 },
      ],
    },
  },
  "select-shop": {
    slug: "select-shop",
    name: "脈線美睫 Pulse Lash",
    category: "美睫・個人工作室",
    tagline: "線上預約・刮刮樂留客・LINE 雙向通知",
    description:
      "預約制美睫個人工作室示範站：線上選項目與時段、價目表展示、手機刮刮樂領券與 VIP 熟客名單回收。",
    phone: "0900-123-456",
    hours: "週二至週日 11:00 – 20:00（週一公休）",
    address: "台北市中山區南京東路二段 100 號 2 樓",
    mapUrl: "https://maps.google.com/?q=台北市中山區南京東路二段100號",
    lineUrl: "https://line.me/R/ti/p/@pulselash",
    banner:
      "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1800&q=80",
    theme: "nail",
    mode: "service",
    announcement: "首次嫁接體驗現折 $100，請先線上預約或加入 LINE。",
    welcomeMessage: "預約完成後可玩刮刮樂領回訪券；系統會推播行前提醒給您。",
    showCampaign: true,
    showContactForm: true,
    products: [
      {
        id: "classic-lash",
        name: "經典單根嫁接",
        price: 1280,
        description: "自然濃密，適合日常通勤。約 90 分鐘。",
        durationMinutes: 90,
        image:
          "https://images.unsplash.com/photo-1583003879475-00b473e0f2c1?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "volume-lash",
        name: "俏麗山根開花",
        price: 1680,
        description: "輕盈開花款，眼神更立體。約 120 分鐘。",
        durationMinutes: 120,
        image:
          "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "lash-lift",
        name: "睫毛燙＋染",
        price: 980,
        description: "不嫁接也能有捲翹感，維持約 6–8 週。",
        durationMinutes: 75,
        image:
          "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "lash-remove",
        name: "卸睫＋護理",
        price: 450,
        description: "溫和卸除與眼周保養，適合銜接下次造型。",
        durationMinutes: 45,
        image:
          "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=80",
      },
    ],
    campaign: {
      name: "美睫回訪刮刮樂",
      prize: "一獎現折 $100、二獎睫毛雨衣體驗、三獎熟客 9 折券",
      expiresAt: "2026-12-31",
      quota: 100,
      prizes: [
        { id: "lash-1", label: "一獎：現折 $100", quantity: 8 },
        { id: "lash-2", label: "二獎：睫毛雨衣體驗", quantity: 12 },
        { id: "lash-3", label: "三獎：熟客 9 折券", quantity: 40 },
        { id: "lash-4", label: "感謝獎：到店小禮一份", quantity: 40 },
      ],
    },
  },
};

/** 舊 slug 相容轉址對照 */
export const STORE_SLUG_ALIASES: Record<string, string> = {
  "sample-cafe": "brunch-house",
  "sample-nail": "nail-studio",
  "sample-hair": "hair-salon",
};

export function listStoreSlugs() {
  return Object.keys(STORES_DB);
}

export function resolveStoreSlug(slug: string): string {
  return STORE_SLUG_ALIASES[slug] ?? slug;
}

export function getStoreBySlug(slug: string): StoreTenant | null {
  const resolved = resolveStoreSlug(slug);
  return STORES_DB[resolved] ?? null;
}

export function getAllStores(): StoreTenant[] {
  return Object.values(STORES_DB);
}
