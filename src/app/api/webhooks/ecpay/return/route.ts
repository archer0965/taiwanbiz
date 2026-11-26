import { NextResponse } from "next/server";

export const instant = false;

function resolveSafeNext(raw: string | null, storeId: string): string {
  const candidate = (raw || "").trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("://")) {
    return candidate;
  }
  if (storeId) {
    return `/welcome?storeId=${encodeURIComponent(storeId)}`;
  }
  return "/dashboard/billing";
}

async function handleReturn(request: Request) {
  const url = new URL(request.url);
  let storeId = (url.searchParams.get("storeId") || "").trim().toLowerCase();
  const nextParam = url.searchParams.get("next");

  if (!storeId && request.method === "POST") {
    try {
      const text = await request.text();
      const params = new URLSearchParams(text);
      storeId = (params.get("CustomField1") || params.get("storeId") || "")
        .trim()
        .toLowerCase();
    } catch {
      /* ignore malformed body; server-to-server ReturnURL handles fulfillment */
    }
  }

  const targetPath = resolveSafeNext(nextParam, storeId);
  return NextResponse.redirect(new URL(targetPath, url.origin), 303);
}

/**
 * 綠界 OrderResultURL 瀏覽器導回端點（POST → 303 GET）。
 * Next.js 靜態預渲染頁面（/welcome）不接受 POST 會回 405，故統一經由此端點轉址。
 */
export async function POST(request: Request) {
  return handleReturn(request);
}

export async function GET(request: Request) {
  return handleReturn(request);
}
