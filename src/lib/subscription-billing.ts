import {
  getTenantDbByStoreId,
  listTenantDb,
  patchTenantDb,
  upsertTenantDb,
} from "@/lib/tenant-db.server";
import {
  billingDatesAfterFailure,
  billingDatesAfterSuccess,
  GRACE_PERIOD_DAYS,
  isTenantExpiredByDate,
  isTenantOnTrial,
  isWithinGracePeriod,
  normalizeTenant,
  planMonthlyAmount,
  type TenantBillingMethod,
  type TenantPlanType,
  type TenantRecord,
} from "@/lib/tenants";
import {
  buildDynamicCheckoutPayload,
  cancelEcpayPeriodOrder,
  createCardToken,
  createMerchantMemberId,
  createRenewalToken,
  createTradeNo,
  ecpayMode,
  siteBaseUrl,
} from "@/lib/ecpay";
import { assertSubscriptionEcpayPayment } from "@/lib/architecture-constraints";
import {
  applyFoundingDiscount,
  FOUNDING_TRIAL_DAYS,
  trialDaysFor,
  type CheckoutPaymentType,
} from "@/lib/pricing";
import { applyBillingCredit } from "@/lib/referral";
import {
  sendAdminNewStoreNotify,
  sendAdminSubscriptionCancelledNotify,
  sendAdminTrialStartedNotify,
  sendRenewalLinkEmail,
  sendStoreWelcomeEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionDunningEmail,
  sendTrialEndedEmail,
  sendTrialStartedEmail,
  sendTrialConvertedEmail,
} from "@/lib/subscription-mail";
import { ensureStoreContentForTenant } from "@/lib/store-content-db.server";
import {
  getFoundingAvailability,
  foundingPayAmount,
  resolveLifelongFounding,
} from "@/lib/founding";

function addDaysIso(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function startSubscriptionCheckout(input: {
  storeId: string;
  planType?: TenantPlanType;
  ownerEmail?: string;
  name?: string;
  planName?: string;
  listAmount?: number;
  /** 綠界付款方式；年繳勿用 period */
  paymentType?: CheckoutPaymentType;
  simulateSuccess?: boolean;
  /** 已含創始／推薦／點數折抵的最終應付；有值時不再套創始折 */
  finalAmount?: number;
}) {
  const storeId = input.storeId.trim().toLowerCase();
  let tenant = await getTenantDbByStoreId(storeId);

  if (!tenant) {
    if (!input.name || !input.planType || !input.ownerEmail) {
      return {
        ok: false as const,
        error: "找不到店家，請先於總管理後台開通或提供完整開通資料",
      };
    }
    tenant = normalizeTenant({
      storeId,
      slug: storeId,
      name: input.name,
      planType: input.planType,
      ownerEmail: input.ownerEmail,
      status: "Pending",
      expiresAt: new Date().toISOString().slice(0, 10),
    });
    await upsertTenantDb(tenant);
  }

  const planType = input.planType ?? tenant.planType;
  const isFoundingMember = resolveLifelongFounding(tenant);
  const listAmount =
    typeof input.listAmount === "number" && input.listAmount > 0
      ? Math.round(input.listAmount)
      : planMonthlyAmount(planType);
  const afterFounding = applyFoundingDiscount(listAmount, isFoundingMember);
  const credited = applyBillingCredit(
    afterFounding,
    tenant.billingCreditBalance || 0,
  );
  const payAmount =
    typeof input.finalAmount === "number" && input.finalAmount > 0
      ? Math.max(1, Math.round(input.finalAmount))
      : Math.max(1, credited.payAmount);
  const planName =
    input.planName || tenant.planName || `拓脈訂閱-${planType}`;

  const payGate = assertSubscriptionEcpayPayment(input.paymentType);
  if (!payGate.ok) {
    return { ok: false as const, error: payGate.error };
  }

  let paymentType: CheckoutPaymentType =
    input.paymentType === "period" ||
    input.paymentType === "credit" ||
    input.paymentType === "atm" ||
    input.paymentType === "cvs"
      ? input.paymentType
      : "credit";
  // 年繳金額不走定期定額（綠界 PeriodAmount 為每期月費）
  if (paymentType === "period" && listAmount >= 2000) {
    paymentType = "credit";
  }

  const orderId = createTradeNo(storeId);
  const merchantMemberId =
    tenant.merchantMemberId || createMerchantMemberId(storeId);

  const checkout = buildDynamicCheckoutPayload({
    storeId,
    planName,
    // 已算好 final／點數折抵：傳應付額且不再套創始折
    amount: payAmount,
    isFoundingMember: false,
    paymentType,
    ownerEmail: input.ownerEmail || tenant.ownerEmail,
    planType,
    merchantMemberId,
    orderId,
  });

  const billingMethod = (
    paymentType === "period" ? "period" : paymentType
  ) as TenantBillingMethod;

  const updated = await patchTenantDb(storeId, {
    planType,
    planName,
    listAmount,
    isFoundingMember,
    status: "Pending",
    billingMethod,
    merchantMemberId,
    pendingPaymentLabel: `待綠界付款（${paymentType}）`,
    pendingTradeNo: orderId,
    pendingPaymentCode: null,
    pendingPaymentExpireAt: null,
    cancelledAt: null,
    cancelReason: null,
    ...(paymentType === "period" ? {} : { periodTradeNo: null }),
  });

  if (checkout.mode === "mock" || input.simulateSuccess) {
    const paid = await handlePaymentWebhook({
      storeId,
      result: "success",
      merchantMemberId,
      tradeNo: orderId,
    });
    return {
      ok: true as const,
      mode: "mock" as const,
      message: "示範模式：已模擬綠界付款成功並開通訂閱",
      tenant: paid.ok ? paid.tenant : updated,
      checkout: null,
      orderId,
      amount: payAmount,
      listAmount,
      isFoundingMember,
      redirectUrl: `${siteBaseUrl()}/welcome?storeId=${encodeURIComponent(storeId)}&mock=1`,
      action: null,
      params: null,
    };
  }

  return {
    ok: true as const,
    mode: "live" as const,
    message: "請導向綠界完成訂閱付款",
    tenant: updated,
    checkout,
    orderId,
    amount: payAmount,
    listAmount,
    isFoundingMember,
    redirectUrl: null,
    action: checkout.action,
    params: checkout.params,
  };
}

/** 管理後台升降級：更新方案原價，創始會員續費仍套終身 8 折 */
export async function changeTenantPlan(input: {
  storeId: string;
  planType: TenantPlanType;
  planName?: string;
  listAmount?: number;
}) {
  const storeId = input.storeId.trim().toLowerCase();
  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) return null;

  const listAmount =
    typeof input.listAmount === "number" && input.listAmount > 0
      ? Math.round(input.listAmount)
      : planMonthlyAmount(input.planType);
  const isFoundingMember = resolveLifelongFounding(tenant);
  const payAmount = applyFoundingDiscount(listAmount, isFoundingMember);
  const planName =
    input.planName || `拓脈訂閱-${input.planType}`;

  const updated = await patchTenantDb(storeId, {
    planType: input.planType,
    planName,
    listAmount,
    isFoundingMember,
  });

  return {
    tenant: updated,
    listAmount,
    payAmount,
    isFoundingMember,
  };
}

export async function handlePaymentWebhook(input: {
  storeId: string;
  result: "success" | "failed";
  merchantMemberId?: string;
  tradeNo?: string;
}) {
  const tenant = await getTenantDbByStoreId(input.storeId);
  if (!tenant) {
    return { ok: false as const, error: "找不到對應店家" };
  }

  if (input.result === "success") {
    const dates = billingDatesAfterSuccess(new Date());
    const periodTradeNo =
      tenant.billingMethod === "period"
        ? (
            input.tradeNo ||
            tenant.pendingTradeNo ||
            tenant.periodTradeNo ||
            ""
          ).trim() || null
        : tenant.periodTradeNo;
    const convertingTrial = Boolean(
      tenant.trialStartedAt && !tenant.lastPaymentAt,
    );
    const updated = await patchTenantDb(tenant.storeId, {
      status: "Active",
      merchantMemberId: input.merchantMemberId || tenant.merchantMemberId,
      cardToken: tenant.cardToken || createCardToken(tenant.storeId),
      pendingPaymentCode: null,
      pendingPaymentLabel: null,
      pendingTradeNo: null,
      pendingPaymentExpireAt: null,
      periodTradeNo,
      // 成功續訂／重新開通時清理解約標記
      cancelledAt: null,
      cancelReason: null,
      // 試用轉正式：清除試用截止（保留 trialStartedAt 作紀錄）
      trialEndsAt: null,
      ...dates,
    });
    // 付款成功：確保獨立網站已建立，並通知店主＋總管
    await ensureStoreContentForTenant(tenant.storeId);
    if (convertingTrial) {
      try {
        await sendTrialConvertedEmail({
          storeName: tenant.name,
          ownerEmail: tenant.ownerEmail,
          storeId: tenant.storeId,
          planType: tenant.planType,
          isFoundingMember: tenant.isFoundingMember,
        });
      } catch (error) {
        console.error("[trial-converted-mail] failed", tenant.storeId, error);
      }
    } else {
      try {
        await sendStoreWelcomeEmail({
          storeName: tenant.name,
          ownerEmail: tenant.ownerEmail,
          storeId: tenant.storeId,
          planType: tenant.planType,
        });
      } catch (error) {
        console.error("[welcome-mail] failed", tenant.storeId, error);
      }
      try {
        await sendAdminNewStoreNotify({
          storeName: tenant.name,
          ownerEmail: tenant.ownerEmail,
          storeId: tenant.storeId,
          planType: tenant.planType,
          planName: tenant.planName,
          listAmount: tenant.listAmount,
          isFoundingMember: tenant.isFoundingMember,
          billingMethod: tenant.billingMethod,
        });
      } catch (error) {
        console.error("[admin-new-store-mail] failed", tenant.storeId, error);
      }
    }
    return {
      ok: true as const,
      result: "success" as const,
      tenant: updated,
      message: convertingTrial
        ? "扣款成功：試用已轉為正式訂閱"
        : "扣款成功：店家已啟用，獨立前台已開通",
    };
  }

  const failDates = billingDatesAfterFailure(new Date());
  const updated = await patchTenantDb(tenant.storeId, {
    status: "Pending",
    ...failDates,
  });

  let mail:
    | { ok: true; provider: string }
    | { ok: false; skipped?: boolean; error: string };
  try {
    const listAmount =
      tenant.listAmount ?? planMonthlyAmount(tenant.planType);
    const sent = await sendSubscriptionDunningEmail({
      storeName: tenant.name,
      ownerEmail: tenant.ownerEmail,
      storeId: tenant.storeId,
      gracePeriodEndsAt: failDates.gracePeriodEndsAt,
      amount: foundingPayAmount(listAmount, tenant),
    });
    mail = { ok: true, provider: sent.provider };
  } catch (error) {
    mail = {
      ok: false,
      skipped: true,
      error: error instanceof Error ? error.message : "催繳通知寄送失敗",
    };
  }

  return {
    ok: true as const,
    result: "failed" as const,
    tenant: updated,
    mail,
    message:
      "扣款失敗：狀態改為 Pending，已設定寬限期，並嘗試發送催繳通知",
  };
}

/**
 * 前 15 組創始：占用名額並開通 14 天免費試用。
 * 試用結束後請以綠界依終身 8 折續費（不再免付費展延）。
 */
export async function activateFoundingFreeSubscription(input: {
  storeId: string;
  name: string;
  ownerEmail: string;
  planType: TenantPlanType;
  planName?: string;
  listAmount?: number;
  billingMethod?: TenantBillingMethod;
}) {
  const storeId = input.storeId.trim().toLowerCase();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const founding = await getFoundingAvailability();
  let tenant = await getTenantDbByStoreId(storeId);

  if (tenant?.isFoundingMember && tenant.lastPaymentAt && !isTenantOnTrial(tenant)) {
    return {
      ok: true as const,
      alreadyActive: true as const,
      tenant,
      message: "此店家已是創始會員（續費終身 8 折）",
      redirectUrl: `/welcome?storeId=${encodeURIComponent(storeId)}&founding=1`,
    };
  }

  if (tenant?.isFoundingMember && isTenantOnTrial(tenant)) {
    return {
      ok: true as const,
      alreadyActive: true as const,
      alreadyOnTrial: true as const,
      phase: "trial" as const,
      tenant,
      trialEndsAt: tenant.trialEndsAt,
      message: `創始試用進行中（至 ${tenant.trialEndsAt?.slice(0, 10) || "—"}）。試用結束後請以 8 折綠界續費。`,
      redirectUrl: `/welcome?storeId=${encodeURIComponent(storeId)}&founding=1&trial=1`,
    };
  }

  if (!tenant?.isFoundingMember && !founding.available) {
    return {
      ok: false as const,
      error: "創始名額限量 10 組已額滿，無法申請",
      founding,
    };
  }

  if (tenant?.trialStartedAt && !tenant.isFoundingMember) {
    return {
      ok: false as const,
      error: "此店家已使用過試用，無法再占用創始名額",
    };
  }

  const now = new Date();
  const planType = input.planType;
  const listAmount =
    typeof input.listAmount === "number" && input.listAmount > 0
      ? Math.round(input.listAmount)
      : planMonthlyAmount(planType);
  const planName =
    input.planName || tenant?.planName || `拓脈訂閱-${planType}`;
  const billingMethod = input.billingMethod || "credit";
  const trialDays = FOUNDING_TRIAL_DAYS;
  const trialEndsAt = addDaysIso(now, trialDays);
  const expiresAt = trialEndsAt.slice(0, 10);

  if (!tenant) {
    tenant = normalizeTenant({
      storeId,
      slug: storeId,
      name: input.name.trim() || storeId,
      planType,
      ownerEmail: ownerEmail || `owner.${storeId}@pending.local`,
      status: "Active",
      expiresAt,
      nextBillingDate: trialEndsAt,
      isFoundingMember: true,
      billingMethod,
      planName,
      listAmount,
      trialStartedAt: now.toISOString(),
      trialEndsAt,
      lastPaymentAt: null,
      cancelledAt: null,
      cancelReason: null,
      pendingPaymentLabel: `創始＋${trialDays} 天試用`,
      expiryReminderForExpiresAt: null,
      expiryReminderD1ForExpiresAt: null,
      expiryReminderSentAt: null,
    });
    tenant = await upsertTenantDb(tenant);
  } else {
    const updated = await patchTenantDb(storeId, {
      name: input.name.trim() || tenant.name,
      ownerEmail: ownerEmail || tenant.ownerEmail,
      planType,
      planName,
      listAmount,
      isFoundingMember: true,
      billingMethod,
      status: "Active",
      expiresAt,
      nextBillingDate: trialEndsAt,
      trialStartedAt: now.toISOString(),
      trialEndsAt,
      lastPaymentAt: null,
      cancelledAt: null,
      cancelReason: null,
      gracePeriodEndsAt: null,
      pendingPaymentCode: null,
      pendingPaymentLabel: `創始＋${trialDays} 天試用`,
      pendingTradeNo: null,
      pendingPaymentExpireAt: null,
      expiryReminderForExpiresAt: null,
      expiryReminderD1ForExpiresAt: null,
      expiryReminderSentAt: null,
    });
    if (!updated) {
      return { ok: false as const, error: "無法完成創始試用開通" };
    }
    tenant = updated;
  }

  await ensureStoreContentForTenant(storeId);
  try {
    await sendStoreWelcomeEmail({
      storeName: tenant.name,
      ownerEmail: tenant.ownerEmail,
      storeId: tenant.storeId,
      planType,
    });
  } catch {
    /* ignore */
  }
  try {
    await sendAdminNewStoreNotify({
      storeId: tenant.storeId,
      storeName: tenant.name,
      ownerEmail: tenant.ownerEmail,
      planType,
      planName: tenant.planName || planName,
      listAmount: tenant.listAmount,
      isFoundingMember: true,
      billingMethod,
    });
  } catch {
    /* ignore */
  }

  const foundingAfter = await getFoundingAvailability();
  const renewPreview = applyFoundingDiscount(listAmount, true);
  return {
    ok: true as const,
    alreadyActive: false as const,
    phase: "trial" as const,
    tenant,
    message: `創始名額開通成功：前 ${FOUNDING_TRIAL_DAYS} 天免費試用（限量前 ${founding.limit} 組；剩餘 ${foundingAfter.remaining}）。試用結束後續費終身 8 折（約 NT$ ${renewPreview.toLocaleString("zh-TW")}／期）。`,
    redirectUrl: `/welcome?storeId=${encodeURIComponent(storeId)}&founding=1&trial=1`,
    founding: foundingAfter,
  };
}

/**
 * 新店先註冊開通免費試用（不經扣款）
 * - 創始：14 天；額滿後一般新店：3 天
 * - 每店僅能開通一次試用
 */
export async function startFreeTrial(input: {
  storeId: string;
  name: string;
  ownerEmail: string;
  planType: TenantPlanType;
  planName?: string;
  listAmount?: number;
  isFoundingMember?: boolean;
  billingMethod?: TenantBillingMethod;
}) {
  const storeId = input.storeId.trim().toLowerCase();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  let tenant = await getTenantDbByStoreId(storeId);

  if (tenant?.lastPaymentAt) {
    return {
      ok: false as const,
      error: "此店家已正式訂閱，無法再開通免費試用",
    };
  }
  if (tenant?.trialStartedAt) {
    if (isTenantOnTrial(tenant)) {
      return {
        ok: true as const,
        alreadyOnTrial: true as const,
        tenant,
        trialEndsAt: tenant.trialEndsAt,
        message: "此店家已在試用中",
        redirectUrl: `/welcome?storeId=${encodeURIComponent(storeId)}&trial=1`,
      };
    }
    return {
      ok: false as const,
      error: "此店家已使用過免費試用，請直接正式訂閱付款",
    };
  }

  const now = new Date();
  const isFoundingMember = resolveLifelongFounding(
    tenant,
    Boolean(input.isFoundingMember),
  );
  const days = trialDaysFor(isFoundingMember);
  const trialEndsAt = addDaysIso(now, days);
  const expiresAt = trialEndsAt.slice(0, 10);
  const planType = input.planType;
  const listAmount =
    typeof input.listAmount === "number" && input.listAmount > 0
      ? Math.round(input.listAmount)
      : planMonthlyAmount(planType);
  const billingMethod = input.billingMethod || "credit";
  const planName =
    input.planName || tenant?.planName || `拓脈訂閱-${planType}`;

  if (!tenant) {
    tenant = normalizeTenant({
      storeId,
      slug: storeId,
      name: input.name.trim() || storeId,
      planType,
      ownerEmail: ownerEmail || `owner.${storeId}@pending.local`,
      status: "Active",
      expiresAt,
      nextBillingDate: trialEndsAt,
      isFoundingMember,
      billingMethod,
      planName,
      listAmount,
      trialStartedAt: now.toISOString(),
      trialEndsAt,
      lastPaymentAt: null,
      cancelledAt: null,
      cancelReason: null,
      pendingPaymentLabel: `先註冊・${days} 天試用`,
      expiryReminderForExpiresAt: null,
      expiryReminderD1ForExpiresAt: null,
      expiryReminderSentAt: null,
    });
    tenant = await upsertTenantDb(tenant);
  } else {
    const updated = await patchTenantDb(storeId, {
      name: input.name.trim() || tenant.name,
      ownerEmail: ownerEmail || tenant.ownerEmail,
      planType,
      planName,
      listAmount,
      isFoundingMember,
      billingMethod,
      status: "Active",
      expiresAt,
      nextBillingDate: trialEndsAt,
      trialStartedAt: now.toISOString(),
      trialEndsAt,
      lastPaymentAt: null,
      cancelledAt: null,
      cancelReason: null,
      gracePeriodEndsAt: null,
      pendingPaymentCode: null,
      pendingPaymentLabel: `先註冊・${days} 天試用`,
      pendingTradeNo: null,
      pendingPaymentExpireAt: null,
      expiryReminderForExpiresAt: null,
      expiryReminderD1ForExpiresAt: null,
      expiryReminderSentAt: null,
    });
    if (!updated) {
      return { ok: false as const, error: "無法開通試用" };
    }
    tenant = updated;
  }

  await ensureStoreContentForTenant(storeId);

  try {
    await sendTrialStartedEmail({
      storeName: tenant.name,
      ownerEmail: tenant.ownerEmail,
      storeId,
      planType,
      trialEndsAt,
      isFoundingMember,
      listAmount,
    });
  } catch (error) {
    console.error("[trial-started-mail] failed", storeId, error);
  }
  try {
    await sendAdminTrialStartedNotify({
      storeName: tenant.name,
      ownerEmail: tenant.ownerEmail,
      storeId,
      planType,
      planName,
      listAmount,
      isFoundingMember,
      trialEndsAt,
    });
  } catch (error) {
    console.error("[admin-trial-mail] failed", storeId, error);
  }

  return {
    ok: true as const,
    alreadyOnTrial: false as const,
    tenant,
    trialEndsAt,
    message: isFoundingMember
      ? `已先註冊並開通 ${days} 天創始免費試用，期滿前請以 8 折完成正式訂閱`
      : `已先註冊並開通 ${days} 天免費試用，剩餘 1 天會提醒續費；期滿前請完成正式訂閱`,
    redirectUrl: `/welcome?storeId=${encodeURIComponent(storeId)}&trial=1`,
  };
}

/** 試用到期：改 Pending＋保留網站寬限，並寄轉正式訂閱通知；寬限結束後才 Suspended */
export async function runTrialExpiryCron(now = new Date()) {
  const tenants = await listTenantDb();
  const ended: TenantRecord[] = [];
  const skipped: string[] = [];

  for (const tenant of tenants) {
    if (!tenant.trialEndsAt || tenant.lastPaymentAt) {
      skipped.push(`${tenant.storeId}:not-on-trial`);
      continue;
    }
    if (tenant.status === "Suspended" || tenant.cancelledAt) {
      skipped.push(`${tenant.storeId}:inactive`);
      continue;
    }
    // 已進入試用後催繳／Pending 則略過重寄
    if (tenant.status === "Pending" && tenant.gracePeriodEndsAt) {
      skipped.push(`${tenant.storeId}:already-pending`);
      continue;
    }
    const end = new Date(tenant.trialEndsAt).getTime();
    if (Number.isNaN(end) || end > now.getTime()) {
      skipped.push(`${tenant.storeId}:not-due`);
      continue;
    }

    const fail = billingDatesAfterFailure(now);
    const token = createRenewalToken();
    const payAmount = foundingPayAmount(
      tenant.listAmount ?? planMonthlyAmount(tenant.planType),
      tenant,
    );
    const renewUrl = `${siteBaseUrl()}/billing/renew?storeId=${encodeURIComponent(tenant.storeId)}&token=${encodeURIComponent(token)}&trial=1`;

    const updated = await patchTenantDb(tenant.storeId, {
      status: "Pending",
      renewalToken: token,
      gracePeriodEndsAt: fail.gracePeriodEndsAt,
      pendingPaymentLabel: `試用結束・網站保留 ${GRACE_PERIOD_DAYS} 天`,
      // 寬限內保留網站；寬限結束才 Suspended
    });
    if (!updated) continue;
    ended.push(updated);

    try {
      await sendTrialEndedEmail({
        storeName: updated.name,
        ownerEmail: updated.ownerEmail,
        storeId: updated.storeId,
        payAmount,
        isFoundingMember: updated.isFoundingMember,
        renewUrl,
        gracePeriodEndsAt: fail.gracePeriodEndsAt,
      });
    } catch (error) {
      console.error("[trial-ended-mail] failed", updated.storeId, error);
    }
  }

  return {
    endedCount: ended.length,
    ended,
    skipped,
  };
}

export async function runSubscriptionCron(now = new Date()) {
  const tenants = await listTenantDb();
  const suspended: TenantRecord[] = [];
  const keptPending: TenantRecord[] = [];
  const cancelledEnded: TenantRecord[] = [];
  const expiredEnded: TenantRecord[] = [];

  // 先發到期前 3 天提醒（仍 Active 時）
  const expiryReminders = await runExpiryReminderCron(now);
  const trials = await runTrialExpiryCron(now);

  for (const tenant of tenants) {
    if (tenant.status !== "Pending" || !tenant.gracePeriodEndsAt) continue;
    const graceEnd = new Date(tenant.gracePeriodEndsAt).getTime();
    if (Number.isNaN(graceEnd)) continue;
    if (graceEnd <= now.getTime()) {
      const updated = await patchTenantDb(tenant.storeId, {
        status: "Suspended",
      });
      if (updated) {
        suspended.push(updated);
        await notifySubscriptionExpired(updated);
      }
    } else {
      keptPending.push(tenant);
    }
  }

  // 已解約：當期結束後暫停前台／後台
  for (const tenant of tenants) {
    if (!tenant.cancelledAt) continue;
    if (tenant.status === "Suspended") continue;
    const endMs = tenant.nextBillingDate
      ? new Date(tenant.nextBillingDate).getTime()
      : tenant.expiresAt
        ? new Date(`${tenant.expiresAt}T23:59:59.999Z`).getTime()
        : NaN;
    if (Number.isNaN(endMs) || endMs > now.getTime()) continue;
    const updated = await patchTenantDb(tenant.storeId, {
      status: "Suspended",
      cardToken: null,
      pendingPaymentCode: null,
      pendingPaymentLabel: null,
      pendingTradeNo: null,
      pendingPaymentExpireAt: null,
      renewalToken: null,
    });
    if (updated) {
      suspended.push(updated);
      cancelledEnded.push(updated);
      await notifySubscriptionExpired(updated);
    }
  }

  // Active：方案到期未續費 → 先進入 30 天保留網站寬限（Pending）
  const fresh = await listTenantDb();
  for (const tenant of fresh) {
    if (tenant.status === "Suspended") continue;
    if (tenant.cancelledAt) continue; // 已於上方處理
    if (isTenantOnTrial(tenant, now)) continue;
    if (!isTenantExpiredByDate(tenant, now)) continue;

    // 已在寬限內：等寬限 cron 處理
    if (tenant.gracePeriodEndsAt && isWithinGracePeriod(tenant, now)) {
      continue;
    }
    // 寬限已過且仍 Pending：上方迴圈會 Suspended
    if (
      tenant.status === "Pending" &&
      tenant.gracePeriodEndsAt &&
      !isWithinGracePeriod(tenant, now)
    ) {
      continue;
    }

    const fail = billingDatesAfterFailure(now);
    const updated = await patchTenantDb(tenant.storeId, {
      status: "Pending",
      gracePeriodEndsAt: fail.gracePeriodEndsAt,
      pendingPaymentLabel: `逾期未續費・網站保留 ${GRACE_PERIOD_DAYS} 天`,
      pendingPaymentCode: null,
      pendingTradeNo: null,
      pendingPaymentExpireAt: null,
    });
    if (updated) {
      keptPending.push(updated);
      expiredEnded.push(updated);
      try {
        const { pushSellerNotification } = await import(
          "@/lib/seller-notifications-db.server"
        );
        pushSellerNotification({
          storeId: updated.storeId,
          ownerEmail: updated.ownerEmail,
          kind: "subscription_expiry_reminder",
          title: `方案已到期，網站仍保留 ${GRACE_PERIOD_DAYS} 天`,
          body: `「${updated.name}」訂閱已到期。前台網站仍可保留至 ${fail.gracePeriodEndsAt.slice(0, 10)}，請儘速續費以免暫停。`,
          href: `${siteBaseUrl()}/dashboard/billing`,
        });
      } catch (error) {
        console.error("[expiry-grace-notify]", updated.storeId, error);
      }
    }
  }

  const renewals = await runMonthlyRenewalCron(now);

  return {
    checkedAt: now.toISOString(),
    mode: ecpayMode(),
    suspendedCount: suspended.length,
    pendingInGrace: keptPending.length,
    cancelledEndedCount: cancelledEnded.length,
    expiredEndedCount: expiredEnded.length,
    trialEndedCount: trials.endedCount,
    suspended,
    cancelledEnded,
    expiredEnded,
    trials,
    renewals,
    expiryReminders,
  };
}

async function notifySubscriptionExpired(tenant: TenantRecord) {
  try {
    const { pushSellerNotification } = await import(
      "@/lib/seller-notifications-db.server"
    );
    const { pushLineText, parseLineUserIds } = await import(
      "@/lib/line-messaging"
    );
    const renewUrl = `${siteBaseUrl()}/dashboard/billing`;
    pushSellerNotification({
      storeId: tenant.storeId,
      ownerEmail: tenant.ownerEmail,
      kind: "subscription_expired",
      title: "方案已到期，預約已暫停",
      body: `「${tenant.name}」訂閱已到期（expires_at: ${tenant.expiresAt}）。前台將顯示系統維護／方案已到期暫停預約，請儘速續費。`,
      href: renewUrl,
    });
    for (const uid of parseLineUserIds(
      process.env.BOOKING_SELLER_LINE_USER_IDS,
    )) {
      await pushLineText(
        uid,
        `【方案已到期】${tenant.name}（${tenant.storeId}）訂閱已到期，前台預約已暫停。請登入後台續費：${renewUrl}`,
      );
    }
  } catch (error) {
    console.error("[subscription-expired-notify]", tenant.storeId, error);
  }
}

function ymdUtc(d: Date | string) {
  const iso =
    typeof d === "string"
      ? d.includes("T")
        ? d
        : `${d.slice(0, 10)}T00:00:00.000Z`
      : d.toISOString();
  return iso.slice(0, 10);
}

function dayOffsetFromToday(expiryYmd: string, todayYmd: string) {
  const exp = new Date(`${expiryYmd}T00:00:00.000Z`).getTime();
  const today = new Date(`${todayYmd}T00:00:00.000Z`).getTime();
  if (Number.isNaN(exp) || Number.isNaN(today)) return null;
  return Math.round((exp - today) / (24 * 60 * 60 * 1000));
}

/**
 * 若賣家已在「到期前一日」或之後完成續費／正式開通，則略過提醒。
 */
function hasRenewedOnOrAfterDayBeforeExpiry(
  tenant: TenantRecord,
  expiresLabel: string,
) {
  if (!tenant.lastPaymentAt) return false;
  const paidDay = ymdUtc(tenant.lastPaymentAt);
  const exp = new Date(`${expiresLabel}T00:00:00.000Z`);
  if (Number.isNaN(exp.getTime())) return false;
  exp.setUTCDate(exp.getUTCDate() - 1);
  const dayBefore = exp.toISOString().slice(0, 10);
  return paidDay >= dayBefore;
}

/**
 * 到期提醒：
 * - 創始 14 天試用／正式訂閱：到期前 3 天與前 1 天
 * - 一般 3 天試用：僅到期前 1 天
 * 若已在到期前一日（含）完成續費則不通知。
 */
export async function runExpiryReminderCron(now = new Date()) {
  const { sendSubscriptionExpiryReminderEmail } = await import(
    "@/lib/subscription-mail"
  );
  const { pushLineText, parseLineUserIds } = await import(
    "@/lib/line-messaging"
  );
  const { pushSellerNotification } = await import(
    "@/lib/seller-notifications-db.server"
  );
  const tenants = await listTenantDb();
  const reminded: string[] = [];
  const skipped: string[] = [];
  const todayYmd = ymdUtc(now);

  for (const tenant of tenants) {
    if (tenant.status !== "Active" && tenant.status !== "Pending") {
      skipped.push(`${tenant.storeId}:not-active`);
      continue;
    }

    const onTrial = isTenantOnTrial(tenant, now);
    const expiresLabel =
      onTrial && tenant.trialEndsAt
        ? ymdUtc(tenant.trialEndsAt)
        : tenant.expiresAt
          ? ymdUtc(tenant.expiresAt)
          : "";

    if (!expiresLabel) {
      skipped.push(`${tenant.storeId}:no-expires`);
      continue;
    }

    const daysLeft = dayOffsetFromToday(expiresLabel, todayYmd);
    // 一般 3 天試用：只在剩餘 1 天提醒
    const shortNonFoundingTrial =
      onTrial && !tenant.isFoundingMember;
    if (shortNonFoundingTrial) {
      if (daysLeft !== 1) {
        skipped.push(`${tenant.storeId}:short-trial-not-d1`);
        continue;
      }
    } else if (daysLeft !== 3 && daysLeft !== 1) {
      skipped.push(`${tenant.storeId}:not-window`);
      continue;
    }

    // 已續費（到期前一日或之後付款）→ 不通知
    if (hasRenewedOnOrAfterDayBeforeExpiry(tenant, expiresLabel)) {
      skipped.push(`${tenant.storeId}:renewed-before-notice`);
      continue;
    }

    // 試用中若已正式開通不應走到這裡；雙重保險
    if (onTrial && tenant.lastPaymentAt) {
      skipped.push(`${tenant.storeId}:trial-already-paid`);
      continue;
    }

    const already =
      daysLeft === 3
        ? tenant.expiryReminderForExpiresAt === expiresLabel
        : tenant.expiryReminderD1ForExpiresAt === expiresLabel;
    if (already) {
      skipped.push(
        `${tenant.storeId}:already-reminded-d${daysLeft}`,
      );
      continue;
    }

    const renewUrl = `${siteBaseUrl()}/dashboard/billing`;
    const daysText = daysLeft === 3 ? "3 天" : "1 天";

    try {
      await sendSubscriptionExpiryReminderEmail({
        storeName: tenant.name,
        ownerEmail: tenant.ownerEmail,
        storeId: tenant.storeId,
        expiresAt: expiresLabel,
        renewUrl,
        daysLeft,
      });

      pushSellerNotification({
        storeId: tenant.storeId,
        ownerEmail: tenant.ownerEmail,
        kind: onTrial
          ? "subscription_trial_ending"
          : "subscription_expiry_reminder",
        title: onTrial
          ? `試用將於 ${daysText}後結束，請完成續費`
          : `方案將於 ${daysText}後到期，請儘速續費`,
        body: `「${tenant.name}」將於 ${expiresLabel} 到期（尚餘約 ${daysText}）。逾期未續費仍可保留網站 ${GRACE_PERIOD_DAYS} 天，其後將暫停。`,
        href: renewUrl,
      });

      const lineText = onTrial
        ? `【試用即將結束】${tenant.name} 試用將於 ${expiresLabel} 結束（尚餘約 ${daysText}），請登入後台以${tenant.isFoundingMember ? "創始 8 折" : "原價"}完成首次付費。逾期仍可保留網站 ${GRACE_PERIOD_DAYS} 天。\n${renewUrl}`
        : `【續費提醒】${tenant.name} 方案將於 ${expiresLabel} 到期（尚餘約 ${daysText}）。請登入後台續費；忘記續費仍可保留網站 ${GRACE_PERIOD_DAYS} 天。\n${renewUrl}`;

      for (const uid of parseLineUserIds(
        process.env.BOOKING_SELLER_LINE_USER_IDS,
      )) {
        await pushLineText(uid, lineText);
      }

      await patchTenantDb(tenant.storeId, {
        ...(daysLeft === 3
          ? { expiryReminderForExpiresAt: expiresLabel }
          : { expiryReminderD1ForExpiresAt: expiresLabel }),
        expiryReminderSentAt: now.toISOString(),
      });
      reminded.push(`${tenant.storeId}:d${daysLeft}`);
    } catch (error) {
      console.error("[expiry-reminder]", tenant.storeId, error);
      skipped.push(`${tenant.storeId}:error`);
    }
  }

  return {
    remindedCount: reminded.length,
    reminded,
    skippedCount: skipped.length,
    skipped,
  };
}

/**
 * 店主／總管解約：
 * - 信用卡定期定額：呼叫綠界 Cancel 停用後續扣款
 * - ATM／超商：停止產製續約碼
 * - 預設保留當期服務至 nextBillingDate，到期後由 cron 暫停
 * - immediate=true 時立刻 Suspended
 */
export async function cancelSubscription(input: {
  storeId: string;
  reason?: string;
  immediate?: boolean;
  actorEmail?: string;
}) {
  const storeId = input.storeId.trim().toLowerCase();
  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) {
    return { ok: false as const, error: "找不到店家" };
  }
  if (tenant.status === "Suspended" && tenant.cancelledAt) {
    return {
      ok: true as const,
      alreadyCancelled: true as const,
      tenant,
      message: "此店家已解約並暫停",
      ecpay: null,
    };
  }
  if (tenant.cancelledAt && !input.immediate) {
    return {
      ok: true as const,
      alreadyCancelled: true as const,
      tenant,
      message: "已申請解約，當期結束後將自動停用",
      ecpay: null,
    };
  }

  const reason = (input.reason || "").trim().slice(0, 200) || null;
  let ecpay: Awaited<ReturnType<typeof cancelEcpayPeriodOrder>> | null = null;

  const needsPeriodCancel =
    tenant.billingMethod === "period" ||
    Boolean(tenant.periodTradeNo) ||
    Boolean(tenant.cardToken && tenant.billingMethod !== "atm" && tenant.billingMethod !== "cvs");

  if (needsPeriodCancel) {
    const tradeNo =
      tenant.periodTradeNo ||
      tenant.pendingTradeNo ||
      "";
    if (tradeNo) {
      ecpay = await cancelEcpayPeriodOrder(tradeNo);
      // 綠界失敗時仍標記本站解約，但回傳警告（總管可至綠界後台補操作）
    } else if (ecpayMode() === "live") {
      ecpay = {
        ok: false,
        mode: "live",
        skipped: true,
        error: "找不到定期定額訂單編號，已於本站標記解約；請至綠界後台確認停用",
      };
    } else {
      ecpay = await cancelEcpayPeriodOrder("MOCKTRADE");
    }
  }

  const nowIso = new Date().toISOString();
  const patch: Partial<TenantRecord> = {
    cancelledAt: tenant.cancelledAt || nowIso,
    cancelReason: reason,
    cardToken: null,
    pendingPaymentCode: null,
    pendingPaymentLabel: null,
    pendingTradeNo: null,
    pendingPaymentExpireAt: null,
    renewalToken: null,
  };

  if (input.immediate) {
    patch.status = "Suspended";
    patch.gracePeriodEndsAt = null;
  }

  const updated = await patchTenantDb(storeId, patch);
  if (!updated) {
    return { ok: false as const, error: "更新店家失敗" };
  }

  try {
    await sendSubscriptionCancelledEmail({
      storeName: updated.name,
      ownerEmail: updated.ownerEmail,
      storeId: updated.storeId,
      billingMethod: updated.billingMethod,
      accessUntil: updated.nextBillingDate || updated.expiresAt,
      immediate: Boolean(input.immediate),
      reason,
    });
  } catch (error) {
    console.error("[cancel-mail] owner failed", storeId, error);
  }
  try {
    await sendAdminSubscriptionCancelledNotify({
      storeName: updated.name,
      ownerEmail: updated.ownerEmail,
      storeId: updated.storeId,
      billingMethod: updated.billingMethod,
      actorEmail: input.actorEmail,
      immediate: Boolean(input.immediate),
      reason,
      ecpayOk: ecpay?.ok ?? null,
      ecpayMsg: ecpay?.rtnMsg || ecpay?.error || null,
    });
  } catch (error) {
    console.error("[cancel-mail] admin failed", storeId, error);
  }

  const ecpayWarn =
    ecpay && !ecpay.ok
      ? `（綠界：${ecpay.error || ecpay.rtnMsg || "需至商家後台確認停用"}）`
      : "";

  return {
    ok: true as const,
    alreadyCancelled: false as const,
    tenant: updated,
    ecpay,
    message: input.immediate
      ? `已解約並立即停用${ecpayWarn}`
      : `已解約：後續將不再自動扣款／續約，當期服務可用至帳單日結束後停用${ecpayWarn}`,
  };
}

/**
 * 每月為 ATM／超商訂戶產製新續約連結（客戶點連結後向綠界取新繳費碼）
 * 觸發條件：billingMethod 為 atm／cvs，且下次扣款日已到或 7 天內到期
 */
export async function runMonthlyRenewalCron(now = new Date()) {
  const tenants = await listTenantDb();
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const issued: TenantRecord[] = [];
  const skipped: string[] = [];

  for (const tenant of tenants) {
    if (tenant.billingMethod !== "atm" && tenant.billingMethod !== "cvs") {
      continue;
    }
    if (tenant.status === "Suspended") continue;
    if (tenant.cancelledAt) {
      skipped.push(`${tenant.storeId}:cancelled`);
      continue;
    }
    if (isTenantOnTrial(tenant, now) || (tenant.trialEndsAt && !tenant.lastPaymentAt)) {
      skipped.push(`${tenant.storeId}:trial`);
      continue;
    }

    const nextBilling = tenant.nextBillingDate
      ? new Date(tenant.nextBillingDate).getTime()
      : NaN;
    if (Number.isNaN(nextBilling)) {
      skipped.push(`${tenant.storeId}:no-billing-date`);
      continue;
    }

    const dueSoon = nextBilling - now.getTime() <= windowMs;
    if (!dueSoon) {
      skipped.push(`${tenant.storeId}:not-due`);
      continue;
    }

    // 已有未過期繳費碼則略過，避免重複產碼
    if (tenant.pendingPaymentCode && tenant.pendingPaymentExpireAt) {
      const exp = new Date(tenant.pendingPaymentExpireAt).getTime();
      if (!Number.isNaN(exp) && exp > now.getTime()) {
        skipped.push(`${tenant.storeId}:code-still-valid`);
        continue;
      }
    }

    const token = createRenewalToken();
    const fail = billingDatesAfterFailure(now);
    const listAmount = tenant.listAmount ?? planMonthlyAmount(tenant.planType);
    const afterFounding = applyFoundingDiscount(
      listAmount,
      tenant.isFoundingMember,
    );
    const credited = applyBillingCredit(
      afterFounding,
      Number(tenant.billingCreditBalance) || 0,
    );
    const amount = credited.payAmount;
    const renewUrl = `${siteBaseUrl()}/billing/renew?storeId=${encodeURIComponent(tenant.storeId)}&token=${encodeURIComponent(token)}`;

    const updated = await patchTenantDb(tenant.storeId, {
      status: "Pending",
      renewalToken: token,
      gracePeriodEndsAt: fail.gracePeriodEndsAt,
      pendingPaymentCode: null,
      pendingPaymentLabel: null,
      pendingTradeNo: null,
      pendingPaymentExpireAt: null,
    });

    try {
      await sendRenewalLinkEmail({
        storeName: tenant.name,
        ownerEmail: tenant.ownerEmail,
        storeId: tenant.storeId,
        renewUrl,
        amount,
        billingMethod: tenant.billingMethod,
        nextBillingDate: tenant.nextBillingDate,
      });
    } catch (error) {
      console.error("[renewal-cron] mail failed", tenant.storeId, error);
    }

    if (updated) issued.push(updated);
  }

  return {
    issuedCount: issued.length,
    issuedStoreIds: issued.map((t) => t.storeId),
    skipped,
  };
}

/** 管理後台手動為單店產生續約連結 */
export async function issueRenewalLink(storeId: string) {
  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) return null;
  if (tenant.billingMethod !== "atm" && tenant.billingMethod !== "cvs") {
    return {
      ok: false as const,
      error: "僅 ATM／超商訂戶需要每月續約繳費碼（信用卡定期定額會自動扣款）",
    };
  }

  const token = createRenewalToken();
  const fail = billingDatesAfterFailure(new Date());
  const listAmount = tenant.listAmount ?? planMonthlyAmount(tenant.planType);
  const afterFounding = applyFoundingDiscount(
    listAmount,
    tenant.isFoundingMember,
  );
  const amount = applyBillingCredit(
    afterFounding,
    Number(tenant.billingCreditBalance) || 0,
  ).payAmount;
  const renewUrl = `${siteBaseUrl()}/billing/renew?storeId=${encodeURIComponent(tenant.storeId)}&token=${encodeURIComponent(token)}`;

  const updated = await patchTenantDb(storeId, {
    status: "Pending",
    renewalToken: token,
    gracePeriodEndsAt: fail.gracePeriodEndsAt,
    pendingPaymentCode: null,
    pendingPaymentLabel: null,
    pendingTradeNo: null,
    pendingPaymentExpireAt: null,
  });

  await sendRenewalLinkEmail({
    storeName: tenant.name,
    ownerEmail: tenant.ownerEmail,
    storeId: tenant.storeId,
    renewUrl,
    amount,
    billingMethod: tenant.billingMethod,
    nextBillingDate: tenant.nextBillingDate,
  });

  return { ok: true as const, renewUrl, tenant: updated, amount };
}

export async function manualOverrideStatus(
  storeId: string,
  status: "Active" | "Suspended" | "Pending",
) {
  const tenant = await getTenantDbByStoreId(storeId);
  if (!tenant) return null;
  if (status === "Active") {
    const dates = billingDatesAfterSuccess(new Date());
    return patchTenantDb(storeId, {
      status: "Active",
      ...dates,
      gracePeriodEndsAt: null,
    });
  }
  if (status === "Suspended") {
    return patchTenantDb(storeId, {
      status: "Suspended",
    });
  }
  const fail = billingDatesAfterFailure(new Date());
  return patchTenantDb(storeId, {
    status: "Pending",
    ...fail,
  });
}
