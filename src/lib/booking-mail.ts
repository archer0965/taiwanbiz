import type { BookingRecord } from "@/lib/bookings";
import { formatBookingDiscountLines } from "@/lib/off-peak-discounts";
import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function deliverEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const to = input.to.trim();
  if (!to) throw new Error("missing recipient");

  const smtpUser =
    process.env.SMTP_USER?.trim() ||
    process.env.GMAIL_USER?.trim() ||
    process.env.INQUIRY_TO_EMAIL?.trim() ||
    "";
  const smtpPass =
    process.env.SMTP_PASS?.trim() ||
    process.env.GMAIL_APP_PASSWORD?.trim() ||
    "";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE?.trim() === "true" ||
    (!process.env.SMTP_SECURE && port === 465);

  if (smtpPass && smtpUser) {
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
      from: `"拓脈預約通知" <${smtpUser}>`,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { provider: "smtp" as const };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const from =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      "拓脈預約通知 <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend 寄信失敗：${await res.text()}`);
    }
    return { provider: "resend" as const };
  }

  throw new Error("尚未設定寄信憑證（SMTP／Resend）");
}

function bookingLines(booking: BookingRecord) {
  return [
    `預約編號：${booking.id}`,
    `店家：${booking.storeName}`,
    `顧客：${booking.customerName}`,
    `手機：${booking.customerPhone}`,
    booking.customerEmail ? `Email：${booking.customerEmail}` : "",
    `服務：${booking.serviceName}`,
    booking.staffName ? `服務人員：${booking.staffName}` : "",
    `時段：${booking.slotLabel}`,
    ...formatBookingDiscountLines(booking),
    booking.note ? `備註：${booking.note}` : "",
    ...(booking.referenceImages || []).map((url, i) =>
      url.startsWith("data:")
        ? `參考圖${i + 1}：（內嵌圖片）`
        : `參考圖${i + 1}：${url}`,
    ),
  ].filter(Boolean);
}

export async function sendBookingCustomerReviewEmail(
  to: string,
  booking: BookingRecord,
  opts?: { reviewUrl?: string; igHint?: string },
) {
  const reviewUrl = opts?.reviewUrl?.trim() || "";
  const igHint =
    opts?.igHint?.trim() ||
    "完成服務後歡迎在 IG 標記本店，私訊截圖可享下次小驚喜優惠。";
  const subject = `【服務關心】${booking.storeName}｜歡迎給我們五星回饋`;
  const text = [
    `${booking.customerName} 您好，感謝今天預約「${booking.serviceName}」。`,
    "",
    "希望今天的體驗讓您滿意！",
    igHint,
    reviewUrl ? `五星好評／Google 評論：${reviewUrl}` : "",
    "",
    ...bookingLines(booking),
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】服務關心與好評邀請</h2>
      <p>${escapeHtml(booking.customerName)} 您好，感謝今天的預約。</p>
      <p>${escapeHtml(igHint)}</p>
      ${
        reviewUrl
          ? `<p><a href="${escapeHtml(reviewUrl)}">留下五星好評</a></p>`
          : ""
      }
    </div>`;
  return deliverEmail({ to, subject, text, html });
}

export async function sendBookingSellerEmail(
  to: string,
  booking: BookingRecord,
) {
  const subject = `【新預約接單】${booking.storeName}｜${booking.customerName}｜${booking.slotLabel}`;
  const text = [
    "顧客已完成線上預約，請盡快確認：",
    "",
    ...bookingLines(booking),
    "",
    `時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】新預約即時接單通知</h2>
      <pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px">${escapeHtml(
        bookingLines(booking).join("\n"),
      )}</pre>
    </div>`;
  return deliverEmail({ to, subject, text, html });
}

export async function sendBookingCustomerSuccessEmail(
  to: string,
  booking: BookingRecord,
) {
  const subject = `【預約成功】${booking.storeName}｜${booking.slotLabel}`;
  const text = [
    `${booking.customerName} 您好，您的預約已成立：`,
    "",
    ...bookingLines(booking),
    "",
    "請準時到店；若需改期請提早聯絡店家。行前我們會再提醒您。",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】預約成功通知</h2>
      <p>${escapeHtml(booking.customerName)} 您好，您的預約已成立。</p>
      <pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px">${escapeHtml(
        bookingLines(booking).join("\n"),
      )}</pre>
      <p style="color:#64748b;font-size:13px">行前我們會再提醒您，降低放鳥與錯過時段。</p>
    </div>`;
  return deliverEmail({ to, subject, text, html });
}

export async function sendBookingCustomerReminderEmail(
  to: string,
  booking: BookingRecord,
) {
  const subject = `【行前提醒】明天／即將到店｜${booking.storeName}`;
  const text = [
    `${booking.customerName} 您好，提醒您預約即將到來：`,
    "",
    ...bookingLines(booking),
    "",
    "期待與您見面！如需改期請盡快聯繫店家。",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】預約行前提醒</h2>
      <p>${escapeHtml(booking.customerName)} 您好，提醒您預約即將到來。</p>
      <pre style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px">${escapeHtml(
        bookingLines(booking).join("\n"),
      )}</pre>
    </div>`;
  return deliverEmail({ to, subject, text, html });
}
