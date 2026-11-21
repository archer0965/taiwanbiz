import {
  buildLogisticsMapPayload,
  ecpayMode,
  probeLogisticsMapAvailability,
} from "@/lib/ecpay";
import { NextResponse } from "next/server";

export const instant = false;

/** 產生綠界超商電子地圖表單參數（含開通狀態預檢） */
export async function POST(request: Request) {
  let body: {
    storeSlug?: string;
    pickup?: "711" | "family";
    device?: "0" | "1";
    /** true：略過預檢直接回傳表單（前端即將導向） */
    skipProbe?: boolean;
    /** 超商取貨付款（貨到付款）須代收門市 */
    isCollection?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storeSlug = (body.storeSlug || "").trim().toLowerCase();
  if (!storeSlug) {
    return NextResponse.json({ error: "缺少 storeSlug" }, { status: 400 });
  }

  const pickup = body.pickup === "family" ? "family" : "711";
  const isCollection = Boolean(body.isCollection);

  // mock／未開通：直接回傳手動選店，不開壞掉的地圖
  if (ecpayMode() === "mock") {
    return NextResponse.json({
      ok: false,
      allowManual: true,
      code: "MOCK",
      error: "示範模式未串接綠界物流地圖，請手動輸入取貨門市代號與店名。",
    });
  }

  if (!body.skipProbe) {
    const probe = await probeLogisticsMapAvailability({
      storeSlug,
      pickup,
      isCollection,
    });
    if (!probe.ok) {
      return NextResponse.json({
        ok: false,
        allowManual: true,
        code: probe.code,
        error: probe.message,
        logisticsSubType: "logisticsSubType" in probe ? probe.logisticsSubType : undefined,
        logisticsMode: "logisticsMode" in probe ? probe.logisticsMode : undefined,
      });
    }
  }

  const payload = buildLogisticsMapPayload({
    storeSlug,
    pickup,
    extraData: storeSlug,
    device: body.device === "1" ? "1" : "0",
    isCollection,
  });

  return NextResponse.json({
    ok: true,
    mode: payload.mode,
    action: payload.action,
    params: payload.params,
    logisticsSubType: payload.logisticsSubType,
    logisticsMode: payload.logisticsMode,
  });
}
