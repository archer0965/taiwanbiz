import { getFoundingAvailability } from "@/lib/founding";
import {
  FOUNDING_CYCLE_RATES,
  FOUNDING_FREE_LABEL,
  FOUNDING_MEMBER_RATE,
} from "@/lib/pricing";
import { NextResponse } from "next/server";

export const instant = false;

/** 公開：早鳥名額剩餘（本站獨立 15 名；湊滿後前端隱藏早鳥選項） */
export async function GET() {
  const founding = await getFoundingAvailability();
  return NextResponse.json({
    ok: true,
    ...founding,
    discountLabel: FOUNDING_FREE_LABEL,
    /** @deprecated 請改用 rates；保留年繳倍率相容舊前端 */
    rate: FOUNDING_MEMBER_RATE,
    rates: FOUNDING_CYCLE_RATES,
  });
}
