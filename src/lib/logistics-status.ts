import type { ShopOrderStatus } from "@/lib/store-content";

/**
 * 綠界超商物流 RtnCode → 訂單狀態
 * 參考：https://developers.ecpay.com.tw/7420/
 */
export const LOGISTICS_STATUS_LABEL: Record<string, string> = {
  "300": "訂單處理中",
  "2030": "已送至物流中心",
  "3024": "已送至物流中心",
  "2063": "已送達門市",
  "2073": "已送達門市",
  "3018": "已送達門市",
  "2067": "消費者已取件",
  "3022": "消費者已取件",
  "2074": "七日未取件",
  "3020": "七日未取件",
  "2098": "重新配達取件門市",
  "2099": "重新配達寄件門市",
};

const SHIPPED_CODES = new Set([
  "2030",
  "3024",
  "2063",
  "2073",
  "3018",
  "2098",
]);

const COMPLETED_CODES = new Set(["2067", "3022"]);

const RETURN_UNCLAIMED_CODES = new Set(["2074", "3020", "2099"]);

export function logisticsStatusLabel(code?: string | null) {
  if (!code) return "";
  return LOGISTICS_STATUS_LABEL[code] || `物流狀態 ${code}`;
}

export type LogisticsStatusPatch = {
  status?: ShopOrderStatus;
  shippedAt?: boolean;
  completedAt?: boolean;
  paidAtIfCod?: boolean;
};

/** 依綠界貨態決定訂單狀態變更（不覆寫已完成／已取消） */
export function resolveOrderPatchFromLogistics(
  statusCode: string,
  currentStatus: ShopOrderStatus,
): LogisticsStatusPatch {
  const code = String(statusCode || "").trim();
  if (!code) return {};
  if (
    currentStatus === "completed" ||
    currentStatus === "cancelled" ||
    currentStatus === "refunded"
  ) {
    return {};
  }

  if (COMPLETED_CODES.has(code)) {
    return {
      status: "completed",
      shippedAt: true,
      completedAt: true,
      paidAtIfCod: true,
    };
  }

  if (SHIPPED_CODES.has(code) || RETURN_UNCLAIMED_CODES.has(code)) {
    if (currentStatus === "shipped") return {};
    return {
      status: "shipped",
      shippedAt: true,
    };
  }

  return {};
}
