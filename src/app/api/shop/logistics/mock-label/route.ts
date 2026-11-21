import { NextResponse } from "next/server";

export const instant = false;

/** 示範模式託運單預覽（非綠界正式標籤） */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let fields: Record<string, string> = {};
  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(json)) {
        if (v != null) fields[k] = String(v);
      }
    } else {
      const text = await request.text();
      new URLSearchParams(text).forEach((v, k) => {
        fields[k] = v;
      });
    }
  } catch {
    fields = {};
  }

  const logisticsId = fields.logisticsId || "MOCK";
  const sub = fields.logisticsSubType || "";
  const pay = fields.cvsPaymentNo || "";
  const val = fields.cvsValidationNo || "";

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"/>
  <title>示範託運單 ${logisticsId}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:24px;border:2px dashed #0f766e;border-radius:16px;background:#f0fdfa;color:#134e4a}
    h1{font-size:1.25rem;margin:0 0 8px}
    p{margin:6px 0;font-size:14px}
    .code{font-family:ui-monospace,monospace;font-size:1.4rem;font-weight:700;letter-spacing:.06em}
    .hint{margin-top:20px;font-size:12px;color:#64748b}
  </style>
</head>
<body>
  <h1>示範模式・託運單預覽</h1>
  <p>正式環境會導向綠界列印頁，請列印後貼在包裹上。</p>
  <p>物流編號</p>
  <p class="code">${escapeHtml(logisticsId)}</p>
  <p>物流類型：${escapeHtml(sub || "—")}</p>
  <p>交貨便代碼：${escapeHtml(pay || "—")}／驗證碼：${escapeHtml(val || "—")}</p>
  <p class="hint">請使用瀏覽器列印（Ctrl/Cmd+P）作示範。正式標籤以綠界為準。</p>
  <script>window.print()</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
