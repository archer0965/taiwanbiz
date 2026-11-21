import { siteBaseUrl } from "@/lib/ecpay";
import { NextResponse } from "next/server";

export const instant = false;

function field(
  fields: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    if (fields[key]?.trim()) return fields[key].trim();
    const found = Object.entries(fields).find(
      ([k]) => k.toLowerCase() === key.toLowerCase(),
    );
    if (found?.[1]?.trim()) return found[1].trim();
  }
  return "";
}

/**
 * 綠界電子地圖選店回傳
 * 以 HTML 回傳：優先通知 opener、並一律提供導回結帳頁（避免卡在回調頁）
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const fields: Record<string, string> = {};
  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(json)) {
        if (v != null) fields[k] = String(v);
      }
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      params.forEach((v, k) => {
        fields[k] = v;
      });
    }
  } catch {
    return new NextResponse("ParseError", { status: 400 });
  }

  const storeSlug = field(fields, "ExtraData", "storeSlug", "extraData").toLowerCase();
  const storeId = field(
    fields,
    "CVSStoreID",
    "StoreID",
    "storeid",
    "CVSStoreId",
  );
  const storeName = field(
    fields,
    "CVSStoreName",
    "StoreName",
    "storename",
  );
  const storeAddr = field(
    fields,
    "CVSAddress",
    "Address",
    "cvsaddress",
  );

  const base = siteBaseUrl();
  const targetPath = storeSlug
    ? `/stores/${encodeURIComponent(storeSlug)}?emap=1&storeId=${encodeURIComponent(storeId)}&storeName=${encodeURIComponent(storeName)}&storeAddr=${encodeURIComponent(storeAddr)}#checkout`
    : "/";
  const targetAbs = `${base}${targetPath}`;

  const html = `<!DOCTYPE html><html lang="zh-Hant"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>選店完成</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:1.25rem;color:#0f172a;line-height:1.5}
  a{display:inline-block;margin-top:1rem;padding:.75rem 1.25rem;background:#0d9488;color:#fff;text-decoration:none;border-radius:.75rem;font-weight:600}
  .meta{font-size:.875rem;color:#64748b;margin-top:.75rem}
</style>
</head><body>
<h1 style="font-size:1.25rem;margin:0">選店完成</h1>
<p>正在返回結帳頁…</p>
<p class="meta">${storeName ? `門市：${escapeHtml(storeName)}${storeId ? `（${escapeHtml(storeId)}）` : ""}` : "若未自動跳轉，請點下方按鈕。"}</p>
<p><a id="back" href="${escapeAttr(targetAbs)}">返回結帳</a></p>
<script>
(function () {
  var target = ${JSON.stringify(targetAbs)};
  var payload = {
    type: "ecpay-emap",
    storeId: ${JSON.stringify(storeId)},
    storeName: ${JSON.stringify(storeName)},
    storeAddr: ${JSON.stringify(storeAddr)}
  };
  try {
    if (window.opener && !window.opener.closed) {
      try { window.opener.postMessage(payload, "*"); } catch (e) {}
      try { window.opener.focus(); } catch (e) {}
      // 同步把父視窗導回結帳（避免只 close 彈窗、父頁沒更新）
      try { window.opener.location.href = target; } catch (e) {}
      setTimeout(function () {
        try { window.close(); } catch (e) {}
        // 若瀏覽器不允許關閉彈窗，本頁也導回
        location.replace(target);
      }, 400);
      return;
    }
  } catch (e) {}
  location.replace(target);
})();
</script>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** 少數環境可能以 GET 帶回參數 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fields: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    fields[k] = v;
  });
  // 轉成與 POST 相同處理：組假 Request body
  const fake = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  return POST(fake);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
