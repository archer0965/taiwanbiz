import nodemailer from "nodemailer";
import { BUSINESS_EMAIL } from "@/lib/pricing";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function deliverEmail(subject: string, text: string, html: string) {
  const to = process.env.INQUIRY_TO_EMAIL?.trim() || BUSINESS_EMAIL;
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
      from: `"拓脈訂閱通知" <${smtpUser}>`,
      to,
      subject,
      text,
      html,
      bcc: undefined,
    });
    return { provider: "smtp" as const };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const from =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      "拓脈訂閱通知 <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
        reply_to: undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend 寄信失敗：${await res.text()}`);
    }
    return { provider: "resend" as const };
  }

  // 示範環境無 SMTP 時改寫入 log，避免 webhook 失敗
  console.info("[subscription-dunning:mock-email]", { subject, text });
  return { provider: "console" as const };
}

export async function sendSubscriptionExpiryReminderEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  expiresAt: string;
  renewUrl?: string;
  /** 尚餘天數（1 或 3）；未傳則文案不寫死天數 */
  daysLeft?: number;
}) {
  const daysText =
    input.daysLeft === 1
      ? "1 天"
      : input.daysLeft === 3
        ? "3 天"
        : "數日";
  const subject = `【拓脈續費提醒】${input.storeName} 方案將於 ${daysText}內到期`;
  const text = [
    "拓脈訂閱到期前提醒：",
    "",
    `店家：${input.storeName}`,
    `store_id：${input.storeId}`,
    `到期日：${input.expiresAt}`,
    `尚餘約：${daysText}`,
    "",
    "請於到期前完成續費。若忘記續費，網站仍可保留 30 天，其後才會暫停。",
    input.renewUrl ? `續費連結：${input.renewUrl}` : "請登入後台 → 訂閱付款。",
    `時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】方案到期前 ${escapeHtml(daysText)}提醒</h2>
      <p>店家 <b>${escapeHtml(input.storeName)}</b> 的訂閱將於 <b>${escapeHtml(input.expiresAt)}</b> 到期（尚餘約 ${escapeHtml(daysText)}）。</p>
      <p>請儘速續費。忘記續費時網站仍可保留 30 天，其後才會暫停前台預約。</p>
      ${
        input.renewUrl
          ? `<p><a href="${escapeHtml(input.renewUrl)}">前往續費</a></p>`
          : ""
      }
    </div>`;
  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

export async function sendSubscriptionDunningEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  gracePeriodEndsAt: string;
  amount: number;
}) {
  const graceLocal = new Date(input.gracePeriodEndsAt).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
  });
  const subject = `【拓脈催繳】${input.storeName} 訂閱扣款失敗，請於寬限期內完成付款`;
  const text = [
    "拓脈訂閱自動扣款失敗通知：",
    "",
    `店家：${input.storeName}`,
    `store_id：${input.storeId}`,
    `老闆 Email：${input.ownerEmail}`,
    `金額：NT$ ${input.amount.toLocaleString("zh-TW")}`,
    `寬限期截止：${graceLocal}`,
    "",
    "請儘速更新信用卡或完成付款。超過寬限期後，店家前台將自動暫停（Suspended）。",
    `時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】訂閱扣款失敗催繳</h2>
      <p>店家 <b>${escapeHtml(input.storeName)}</b> 的定期扣款失敗。</p>
      <ul>
        <li>store_id：${escapeHtml(input.storeId)}</li>
        <li>老闆 Email：${escapeHtml(input.ownerEmail)}</li>
        <li>金額：NT$ ${input.amount.toLocaleString("zh-TW")}</li>
        <li>寬限期截止：${escapeHtml(graceLocal)}</li>
      </ul>
      <p style="color:#b45309">超過寬限期未繳費，系統將自動將狀態改為 Suspended，前台顯示維護中。</p>
    </div>
  `;

  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

export async function sendRenewalLinkEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  renewUrl: string;
  amount: number;
  billingMethod: "atm" | "cvs";
  nextBillingDate?: string | null;
}) {
  const methodLabel =
    input.billingMethod === "atm" ? "ATM／金融卡虛擬帳號" : "超商代碼繳費";
  const subject = `【拓脈續約】${input.storeName} 本月繳費連結已開立`;
  const text = [
    "拓脈訂閱續約通知：",
    "",
    `店家：${input.storeName}`,
    `store_id：${input.storeId}`,
    `應付金額：NT$ ${input.amount.toLocaleString("zh-TW")}`,
    `付款方式：${methodLabel}`,
    input.nextBillingDate ? `計費日：${input.nextBillingDate.slice(0, 10)}` : "",
    "",
    "請點下列連結取得本月新的繳費碼（每月重新產碼）：",
    input.renewUrl,
    "",
    `收件：${input.ownerEmail}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】本月續約繳費連結</h2>
      <p>店家 <b>${escapeHtml(input.storeName)}</b> 的 ${escapeHtml(methodLabel)} 續約已開立。</p>
      <ul>
        <li>應付：NT$ ${input.amount.toLocaleString("zh-TW")}</li>
        <li>store_id：${escapeHtml(input.storeId)}</li>
      </ul>
      <p><a href="${escapeHtml(input.renewUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none">取得本月繳費碼</a></p>
      <p style="font-size:12px;color:#64748b">若按鈕無法開啟，請複製：${escapeHtml(input.renewUrl)}</p>
    </div>
  `;

  // 優先寄給店家本人；deliverEmail 預設寄 INQUIRY_TO，這裡覆寫 to
  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

export async function sendRenewalPaymentCodeEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  paymentLabel: string;
  paymentCode: string;
  expireAt?: string;
  amount?: number;
  isFoundingMember?: boolean;
}) {
  const subject = `【拓脈繳費碼】${input.storeName} ${input.paymentLabel}：${input.paymentCode}`;
  const text = [
    "拓脈已取得本月繳費資訊：",
    "",
    `店家：${input.storeName}`,
    `類型：${input.paymentLabel}`,
    `繳費碼／帳號：${input.paymentCode}`,
    input.expireAt ? `繳費期限：${input.expireAt}` : "",
    input.amount
      ? `金額：NT$ ${input.amount.toLocaleString("zh-TW")}${input.isFoundingMember ? "（創始 8 折）" : ""}`
      : "",
    "",
    "請於期限內完成繳費；綠界入帳後系統會自動啟用／展延訂閱。",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】本月${escapeHtml(input.paymentLabel)}</h2>
      <p style="font-size:22px;font-weight:700;letter-spacing:0.04em">${escapeHtml(input.paymentCode)}</p>
      ${input.expireAt ? `<p>繳費期限：${escapeHtml(input.expireAt)}</p>` : ""}
      <p>店家：${escapeHtml(input.storeName)}（${escapeHtml(input.storeId)}）</p>
    </div>
  `;

  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

function siteBase() {
  return (
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://taiwanbiz.vercel.app"
  );
}

function formatLocal(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

/** 寄給店主：14 天試用已開通 */
export async function sendTrialStartedEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  planType?: string;
  trialEndsAt: string;
  isFoundingMember?: boolean;
  listAmount?: number | null;
}) {
  const base = siteBase();
  const storeUrl = `${base}/stores/${encodeURIComponent(input.storeId)}`;
  const billingUrl = `${base}/dashboard/billing`;
  const loginUrl = `${base}/login`;
  const ends = formatLocal(input.trialEndsAt);
  const subject = `【拓脈試用】${input.storeName} 已開通 14 天免費試用`;
  const text = [
    "您的拓脈店家已開通免費試用：",
    "",
    `店家：${input.storeName}`,
    `storeId：${input.storeId}`,
    `試用截止：${ends}`,
    input.isFoundingMember
      ? "創始會員：是（正式訂閱後終身月費 8 折）"
      : "創始會員：否",
    "",
    "試用期間享全功能；截止前請登入後台「訂閱付款」完成正式訂閱，以免服務暫停。",
    `前台：${storeUrl}`,
    `登入：${loginUrl}`,
    `訂閱管理：${billingUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】14 天免費試用已開通</h2>
      <p>店家 <b>${escapeHtml(input.storeName)}</b> 已可使用全功能。</p>
      <ul>
        <li>試用截止：${escapeHtml(ends)}</li>
        <li>前台：<a href="${escapeHtml(storeUrl)}">${escapeHtml(storeUrl)}</a></li>
        <li>後台登入後至「訂閱付款」可轉正式訂閱</li>
      </ul>
    </div>
  `;
  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

/** 寄給總管：新店進入試用 */
export async function sendAdminTrialStartedNotify(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  planType?: string;
  planName?: string | null;
  listAmount?: number | null;
  isFoundingMember?: boolean;
  trialEndsAt: string;
}) {
  const base = siteBase();
  const subject = `【拓脈試用】${input.storeName} 已開通試用`;
  const text = [
    "新店免費試用通知：",
    `店家：${input.storeName}`,
    `storeId：${input.storeId}`,
    `老闆：${input.ownerEmail}`,
    input.planName ? `方案：${input.planName}` : "",
    `試用截止：${formatLocal(input.trialEndsAt)}`,
    input.isFoundingMember ? "創始：是" : "創始：否",
    `總管：${base}/admin/dashboard`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>試用開通</h2><p>${escapeHtml(input.storeName)}（${escapeHtml(input.storeId)}）</p><p>截止：${escapeHtml(formatLocal(input.trialEndsAt))}</p></div>`;
  return deliverEmail(subject, text, html);
}

/** 寄給店主：試用結束請轉正式 */
export async function sendTrialEndedEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  payAmount: number;
  isFoundingMember?: boolean;
  renewUrl: string;
  gracePeriodEndsAt: string;
}) {
  const subject = `【拓脈】${input.storeName} 試用已結束，請完成正式訂閱`;
  const text = [
    "您的免費試用已結束：",
    `店家：${input.storeName}`,
    `應付月費：NT$ ${input.payAmount.toLocaleString("zh-TW")}${input.isFoundingMember ? "（創始 8 折）" : ""}`,
    `寬限截止：${formatLocal(input.gracePeriodEndsAt)}`,
    "",
    `請由此完成付款：${input.renewUrl}`,
    "逾寬限期未付款，前台／後台將自動暫停。",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>試用已結束</h2>
      <p>請完成正式訂閱以繼續使用 <b>${escapeHtml(input.storeName)}</b>。</p>
      <p>應付：NT$ ${input.payAmount.toLocaleString("zh-TW")}</p>
      <p><a href="${escapeHtml(input.renewUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none">前往付款</a></p>
    </div>
  `;
  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

/** 寄給店主：試用已轉正式訂閱 */
export async function sendTrialConvertedEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  planType?: string;
  isFoundingMember?: boolean;
}) {
  const base = siteBase();
  const subject = `【拓脈】${input.storeName} 已轉為正式訂閱`;
  const text = [
    "感謝付款！試用已轉為正式訂閱：",
    `店家：${input.storeName}`,
    `storeId：${input.storeId}`,
    input.isFoundingMember ? "創始 8 折已生效" : "",
    `後台：${base}/dashboard`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>正式訂閱已生效</h2><p>${escapeHtml(input.storeName)} 可繼續使用全功能。</p></div>`;
  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

/** 寄給店主：網站已開通 */
export async function sendStoreWelcomeEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  planType?: string;
}) {
  const base = siteBase();
  const storeUrl = `${base}/stores/${encodeURIComponent(input.storeId)}`;
  const dashboardUrl = `${base}/dashboard`;
  const loginUrl = `${base}/login`;
  const subject = `【拓脈開通】${input.storeName} 獨立網站已建立`;
  const text = [
    "恭喜！您的拓脈店家已開通：",
    "",
    `店家：${input.storeName}`,
    `storeId：${input.storeId}`,
    input.planType ? `方案：${input.planType}` : "",
    "",
    `前台網址：${storeUrl}`,
    `店家後台：${dashboardUrl}`,
    `登入頁：${loginUrl}`,
    "",
    "請使用結帳時填寫的 Email 登入後台，即可自行編輯店家資料、商品與活動。",
    `收件：${input.ownerEmail}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】獨立網站已開通</h2>
      <p>店家 <b>${escapeHtml(input.storeName)}</b> 已建立完成，您可立即開始編輯。</p>
      <ul>
        <li>前台：<a href="${escapeHtml(storeUrl)}">${escapeHtml(storeUrl)}</a></li>
        <li>後台：<a href="${escapeHtml(dashboardUrl)}">${escapeHtml(dashboardUrl)}</a></li>
        <li>登入 Email：${escapeHtml(input.ownerEmail)}</li>
      </ul>
      <p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none">前往登入後台</a></p>
    </div>
  `;

  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

/** 寄給店主：訂閱已解約 */
export async function sendSubscriptionCancelledEmail(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  billingMethod?: string | null;
  accessUntil?: string | null;
  immediate?: boolean;
  reason?: string | null;
}) {
  const base = siteBase();
  const accessLabel = input.accessUntil
    ? new Date(input.accessUntil).toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
      })
    : "當期帳單結束日";
  const subject = input.immediate
    ? `【拓脈】${input.storeName} 訂閱已解約並停用`
    : `【拓脈】${input.storeName} 訂閱解約確認`;
  const text = [
    "您的拓脈訂閱已完成解約申請：",
    "",
    `店家：${input.storeName}`,
    `storeId：${input.storeId}`,
    input.billingMethod ? `原付款方式：${input.billingMethod}` : "",
    input.reason ? `備註：${input.reason}` : "",
    input.immediate
      ? "服務已立即停用（前台／後台將無法使用）。"
      : `後續將不再自動扣款或產製續約碼。當期服務可用至：${accessLabel}，之後系統會自動暫停。`,
    "",
    "若為信用卡定期定額，綠界端後續授權已同步停用（若失敗我們會另行通知）。",
    `重新訂閱：${base}/#pricing`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】訂閱解約確認</h2>
      <p>店家 <b>${escapeHtml(input.storeName)}</b> 的訂閱已解約。</p>
      <ul>
        <li>storeId：${escapeHtml(input.storeId)}</li>
        <li>${
          input.immediate
            ? "狀態：已立即停用"
            : `當期可用至：${escapeHtml(accessLabel)}`
        }</li>
      </ul>
      <p>如需重新開通，請至定價頁重新訂閱。</p>
    </div>
  `;

  return deliverEmailTo(input.ownerEmail || undefined, subject, text, html);
}

/** 寄給總管：店家解約 */
export async function sendAdminSubscriptionCancelledNotify(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  billingMethod?: string | null;
  actorEmail?: string;
  immediate?: boolean;
  reason?: string | null;
  ecpayOk?: boolean | null;
  ecpayMsg?: string | null;
}) {
  const base = siteBase();
  const subject = `【拓脈解約】${input.storeName}（${input.storeId}）`;
  const text = [
    "店家訂閱解約通知：",
    "",
    `店家：${input.storeName}`,
    `storeId：${input.storeId}`,
    `老闆 Email：${input.ownerEmail}`,
    input.actorEmail ? `操作者：${input.actorEmail}` : "",
    input.billingMethod ? `付款方式：${input.billingMethod}` : "",
    input.immediate ? "立即停用：是" : "立即停用：否（當期結束後暫停）",
    input.reason ? `備註：${input.reason}` : "",
    typeof input.ecpayOk === "boolean"
      ? `綠界 Cancel：${input.ecpayOk ? "成功" : "需確認"} ${input.ecpayMsg || ""}`
      : "綠界 Cancel：不適用／未呼叫",
    "",
    `總管後台：${base}/admin/dashboard`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】訂閱解約</h2>
      <p><b>${escapeHtml(input.storeName)}</b>（${escapeHtml(input.storeId)}）已解約。</p>
      <ul>
        <li>老闆：${escapeHtml(input.ownerEmail)}</li>
        <li>操作者：${escapeHtml(input.actorEmail || "—")}</li>
        <li>綠界：${
          typeof input.ecpayOk === "boolean"
            ? input.ecpayOk
              ? "成功"
              : `需確認（${escapeHtml(input.ecpayMsg || "")}）`
            : "不適用"
        }</li>
      </ul>
    </div>
  `;

  return deliverEmail(subject, text, html);
}

/** 寄給總管：有新訂閱／網站自動成立 */
export async function sendAdminNewStoreNotify(input: {
  storeName: string;
  ownerEmail: string;
  storeId: string;
  planType?: string;
  planName?: string | null;
  listAmount?: number | null;
  isFoundingMember?: boolean;
  billingMethod?: string | null;
}) {
  const base = siteBase();
  const storeUrl = `${base}/stores/${encodeURIComponent(input.storeId)}`;
  const adminUrl = `${base}/admin/dashboard`;
  const subject = `【拓脈新訂單】${input.storeName} 已付款並自動開站`;
  const text = [
    "自主訂閱新訂單通知：",
    "",
    `店家：${input.storeName}`,
    `storeId：${input.storeId}`,
    `老闆 Email：${input.ownerEmail}`,
    input.planName ? `方案：${input.planName}` : "",
    input.planType ? `planType：${input.planType}` : "",
    typeof input.listAmount === "number"
      ? `月費原價：NT$ ${input.listAmount.toLocaleString("zh-TW")}`
      : "",
    input.isFoundingMember
      ? "創始會員：是（14 天試用後續費終身 8 折）"
      : "創始會員：否",
    input.billingMethod ? `付款方式：${input.billingMethod}` : "",
    "",
    `前台：${storeUrl}`,
    `總管後台：${adminUrl}`,
    `時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">【拓脈】新訂閱已自動開站</h2>
      <p>店家 <b>${escapeHtml(input.storeName)}</b> 已完成付款，獨立網站已建立。</p>
      <ul>
        <li>storeId：${escapeHtml(input.storeId)}</li>
        <li>老闆 Email：${escapeHtml(input.ownerEmail)}</li>
        <li>方案：${escapeHtml(input.planName || input.planType || "—")}</li>
        <li>創始：${input.isFoundingMember ? "是（續費 8 折）" : "否"}</li>
        <li>前台：<a href="${escapeHtml(storeUrl)}">${escapeHtml(storeUrl)}</a></li>
      </ul>
      <p><a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none">打開總管理後台</a></p>
    </div>
  `;

  // 寄到 INQUIRY_TO／商務信箱（總管）
  return deliverEmail(subject, text, html);
}

async function deliverEmailTo(
  toOverride: string | undefined,
  subject: string,
  text: string,
  html: string,
) {
  const to =
    toOverride?.trim() ||
    process.env.INQUIRY_TO_EMAIL?.trim() ||
    BUSINESS_EMAIL;
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
      from: `"拓脈訂閱通知" <${smtpUser}>`,
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
      "拓脈訂閱通知 <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend 寄信失敗：${await res.text()}`);
    }
    return { provider: "resend" as const };
  }

  console.info("[subscription-mail:mock]", { to, subject, text });
  return { provider: "console" as const };
}
