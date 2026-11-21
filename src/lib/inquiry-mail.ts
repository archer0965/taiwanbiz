import nodemailer from "nodemailer";

export const INQUIRY_TO_EMAIL = "archer0965@gmail.com";

export type InquiryPayload = {
  name: string;
  storeName: string;
  storeType: string;
  phone: string;
  lineId: string;
  plan: string;
  need: string;
};

export type ContactNotifyPayload = {
  storeName: string;
  name: string;
  phone: string;
  message: string;
};

export type LeadNotifyPayload = {
  storeName: string;
  phone: string;
  campaignName: string;
  couponCode: string;
  prize: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function recipient() {
  return process.env.INQUIRY_TO_EMAIL?.trim() || INQUIRY_TO_EMAIL;
}

async function deliverEmail(subject: string, text: string, html: string) {
  const to = recipient();
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
      from: `"拓脈通知" <${smtpUser}>`,
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
      "拓脈通知 <onboarding@resend.dev>";
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

  throw new Error(
    "尚未設定寄信憑證：請設定 GMAIL_APP_PASSWORD（或 RESEND_API_KEY）",
  );
}

export async function sendInquiryEmail(data: InquiryPayload) {
  const subject = `【拓脈諮詢】${data.storeName}｜${data.name}`;
  const text = [
    "收到一筆新的拓脈導入諮詢需求：",
    "",
    `聯絡人：${data.name}`,
    `店家／品牌：${data.storeName}`,
    `店面類型：${data.storeType}`,
    `感興趣方案：${data.plan}`,
    `手機：${data.phone}`,
    `LINE ID：${data.lineId}`,
    "",
    "需求說明：",
    data.need,
    "",
    `送出時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    "",
    "請直接以對方的 LINE ID 或手機回覆。",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】新諮詢通知</h2>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc;width:120px"><b>聯絡人</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(data.name)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>店家／品牌</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(data.storeName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>店面類型</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(data.storeType)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>感興趣方案</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(data.plan)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>手機</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(data.phone)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>LINE ID</b></td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(data.lineId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc"><b>需求說明</b></td><td style="padding:8px;border:1px solid #e2e8f0;white-space:pre-wrap">${escapeHtml(data.need)}</td></tr>
      </table>
      <p style="margin-top:16px;color:#64748b;font-size:13px">請以 LINE 或電話回覆對方。</p>
    </div>
  `;

  return deliverEmail(subject, text, html);
}

export async function sendContactNotifyEmail(data: ContactNotifyPayload) {
  const subject = `【拓脈店家留言】${data.storeName}｜${data.name}`;
  const text = [
    "店家前台收到一筆聯絡留言：",
    "",
    `店家：${data.storeName}`,
    `姓名：${data.name}`,
    `手機：${data.phone}`,
    "",
    "留言內容：",
    data.message,
    "",
    `送出時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】店家前台留言</h2>
      <p><b>店家：</b>${escapeHtml(data.storeName)}</p>
      <p><b>姓名：</b>${escapeHtml(data.name)}</p>
      <p><b>手機：</b>${escapeHtml(data.phone)}</p>
      <p><b>留言：</b></p>
      <pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px">${escapeHtml(data.message)}</pre>
    </div>
  `;

  return deliverEmail(subject, text, html);
}

export async function sendLeadNotifyEmail(data: LeadNotifyPayload) {
  const subject = `【拓脈發券通知】${data.storeName}｜${data.phone}`;
  const text = [
    "有顧客領取了優惠券：",
    "",
    `店家：${data.storeName}`,
    `手機：${data.phone}`,
    `活動：${data.campaignName}`,
    `獎品：${data.prize}`,
    `序號：${data.couponCode}`,
    "",
    `時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】優惠券領取通知</h2>
      <p><b>店家：</b>${escapeHtml(data.storeName)}</p>
      <p><b>手機：</b>${escapeHtml(data.phone)}</p>
      <p><b>活動：</b>${escapeHtml(data.campaignName)}</p>
      <p><b>獎品：</b>${escapeHtml(data.prize)}</p>
      <p><b>序號：</b><code>${escapeHtml(data.couponCode)}</code></p>
    </div>
  `;

  return deliverEmail(subject, text, html);
}
