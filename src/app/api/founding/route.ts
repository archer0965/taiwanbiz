import { getFoundingAvailability } from "@/lib/founding";
import { FOUNDING_MEMBER_RATE } from "@/lib/pricing";
import { NextResponse } from "next/server";

export const instant = false;

/** 公開：創始名額剩餘（湊滿 10 組後前端隱藏創始選項） */
export async function GET() {
  const founding = await getFoundingAvailability();
  return NextResponse.json({
    ok: true,
    ...founding,
    discountLabel: "前 15 組：14 天免費＋續費終身 8 折",
    rate: FOUNDING_MEMBER_RATE,
  });
}
