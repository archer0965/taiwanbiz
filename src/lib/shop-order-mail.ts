import type { ShopOrder } from "@/lib/store-content";
import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function siteBaseUrl() {
  return (
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://taiwanbiz.vercel.app"
  );
}

function pickupLabel(pickup: ShopOrder["pickup"]) {
  if (pickup === "family") return "全家超商取貨";
  if (pickup === "home") return "宅配";
  return "7-11 超商取貨";
}

function paymentLabel(payment: ShopOrder["payment"]) {
  if (payment === "cod") return "超商取貨付款（貨到付款）";
  if (payment === "atm") return "ATM 虛擬帳號";
  return "信用卡";
}

async function deliverEmailTo(
  to: string,
  subject: string,
  text: string,
  html: string,
) {
  const smtpUser =
    process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim() || to;
  const smtpPass =
    process.env.SMTP_PASS?.trim() ||
    process.env.GMAIL_APP_PASSWORD?.trim() ||
    "";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE?.trim() === "true" ||
    (!process.env.SMTP_SECURE && port === 465);

  if (smtpPass) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
      port,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass.replace(/\s+/g, ""),
      },
    });
    await transporter.sendMail({
      from: `"拓脈訂單通知" <${smtpUser}>`,
      to,
      subject,
      text,
      html,
    });
    return { provider: "smtp" as const };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const from =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      "拓脈訂單通知 <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!res.ok) {
      throw new Error(`Resend 寄信失敗：${await res.text()}`);
    }
    return { provider: "resend" as const };
  }

  console.info("[shop-order-mail:mock]", { to, subject, text });
  return { provider: "console" as const };
}

export async function sendShopOrderSellerNotify(input: {
  sellerEmail: string;
  storeName: string;
  order: ShopOrder;
}) {
  const to = input.sellerEmail.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    console.warn("[shop-order-mail] missing seller email", input.order.id);
    return { provider: "skipped" as const };
  }

  const order = input.order;
  const base = siteBaseUrl();
  const dashboardUrl = `${base}/dashboard/orders`;
  const storeUrl = `${base}/stores/${encodeURIComponent(order.storeSlug)}`;
  const when = new Date(order.createdAt).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
  });
  const linesText = order.lines
    .map((line) => {
      const opts = [line.size, line.colorName].filter(Boolean).join("／");
      return `・${line.name}${opts ? `（${opts}）` : ""} × ${line.quantity}＝NT$${Math.round(line.price) * line.quantity}`;
    })
    .join("\n");
  const linesHtml = order.lines
    .map((line) => {
      const opts = [line.size, line.colorName].filter(Boolean).join("／");
      return `<li>${escapeHtml(line.name)}${
        opts ? `（${escapeHtml(opts)}）` : ""
      } × ${line.quantity}＝NT$${Math.round(line.price) * line.quantity}</li>`;
    })
    .join("");

  const total = order.totalAmount ?? order.subtotal;
  const subject = `【新訂單】${input.storeName}｜${order.id}｜NT$${total}`;

  const text = [
    `${input.storeName} 收到一筆新訂單，請盡快備貨出貨。`,
    "",
    `訂單編號：${order.id}`,
    `下單時間：${when}`,
    `顧客：${order.customerName}`,
    `手機：${order.customerPhone}`,
    `取貨：${pickupLabel(order.pickup)}${
      order.storeName
        ? `・${order.storeName}${order.storeCode ? `（${order.storeCode}）` : ""}`
        : ""
    }`,
    `付款：${paymentLabel(order.payment)}`,
    order.promoName
      ? `優惠：${order.promoName}${
          (order.discountAmount || 0) > 0
            ? `（折抵 NT$${order.discountAmount}）`
            : ""
        }`
      : "",
    `商品小計：NT$${order.subtotal}`,
    (order.shippingFee || 0) > 0 ? `運費：NT$${order.shippingFee}` : "",
    `應付金額：NT$${total}`,
    order.note ? `備註：${order.note}` : "",
    "",
    "商品：",
    linesText,
    "",
    `訂單後台：${dashboardUrl}`,
    `店家前台：${storeUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】新訂單通知</h2>
      <p><b>${escapeHtml(input.storeName)}</b> 收到一筆新訂單，請盡快備貨出貨。</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc;width:120px"><b>訂單編號</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(order.id)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>下單時間</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(when)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>顧客</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(order.customerName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>手機</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(order.customerPhone)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>取貨</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(pickupLabel(order.pickup))}${
          order.storeName
            ? `・${escapeHtml(order.storeName)}${
                order.storeCode ? `（${escapeHtml(order.storeCode)}）` : ""
              }`
            : ""
        }</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>付款</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(paymentLabel(order.payment))}</td></tr>
        ${
          order.promoName
            ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>優惠</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(order.promoName)}${
                (order.discountAmount || 0) > 0
                  ? `（折抵 NT$${order.discountAmount}）`
                  : ""
              }</td></tr>`
            : ""
        }
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>應付金額</b></td><td style="padding:8px;border:1px solid #e2e8f0"><b>NT$${total}</b></td></tr>
        ${
          order.note
            ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>備註</b></td><td style="padding:8px;border:1px solid #e2e8f0;white-space:pre-wrap">${escapeHtml(order.note)}</td></tr>`
            : ""
        }
      </table>
      <p style="margin:16px 0 8px"><b>商品</b></p>
      <ul style="margin:0;padding-left:20px">${linesHtml}</ul>
      <p style="margin-top:20px">
        <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">打開訂單後台</a>
      </p>
      <p style="color:#64748b;font-size:13px">前台：<a href="${escapeHtml(storeUrl)}">${escapeHtml(storeUrl)}</a></p>
    </div>
  `;

  return deliverEmailTo(to, subject, text, html);
}
