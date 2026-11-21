"use client";

import { AdminBankTransferPanel } from "@/components/admin/admin-bank-transfer-panel";
import { ProvisionTenantForm } from "@/components/admin/provision-tenant-form";
import { SiteAnalyticsPanel } from "@/components/admin/site-analytics-panel";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  replaceTenants,
  upsertLocalTenant,
} from "@/lib/tenant-storage";
import {
  PLAN_TYPE_LABELS,
  statusTone,
  type TenantRecord,
} from "@/lib/tenants";
import { useClientReady } from "@/lib/use-client-ready";
import {
  CreditCard,
  ExternalLink,
  FileText,
  LayoutDashboard,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  Store,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function AdminDashboard() {
  const ready = useClientReady();
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [booted, setBooted] = useState(false);
  const [showProvision, setShowProvision] = useState(false);
  const [toast, setToast] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);

  async function loadFromServer() {
    const res = await fetch("/api/admin/tenants", { cache: "no-store" });
    if (!res.ok) throw new Error("無法載入租戶資料");
    const data = (await res.json()) as { tenants: TenantRecord[] };
    setTenants(data.tenants);
    replaceTenants(data.tenants);
  }

  if (ready && !booted) {
    setBooted(true);
    void loadFromServer().catch(() => {
      setToast("載入伺服器租戶失敗，請重新登入總管理員");
    });
  }

  useEffect(() => {
    function sync() {
      void loadFromServer().catch(() => undefined);
    }
    window.addEventListener("taiwanbiz-storage", sync);
    return () => window.removeEventListener("taiwanbiz-storage", sync);
  }, []);

  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.status === "Active").length;
    const pending = tenants.filter((t) => t.status === "Pending").length;
    const suspended = tenants.filter((t) => t.status === "Suspended").length;
    return { active, pending, suspended, total: tenants.length };
  }, [tenants]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function patchStatus(
    storeId: string,
    action: "activate" | "suspend" | "pending",
  ) {
    setBusySlug(storeId);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新失敗");
      upsertLocalTenant(data.tenant);
      await loadFromServer();
      flash(
        action === "suspend"
          ? `已暫停 ${storeId}`
          : action === "activate"
            ? `已恢復 ${storeId}`
            : `已標為待付款 ${storeId}`,
      );
    } catch (error) {
      flash(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusySlug(null);
    }
  }

  async function cancelSubscription(storeId: string) {
    if (
      !window.confirm(
        `確認解約並停用 ${storeId}？\n將停止後續展延並立即暫停店家。`,
      )
    ) {
      return;
    }
    setBusySlug(storeId);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          action: "cancel-subscription",
          immediate: true,
          reason: "總管後台解約",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解約失敗");
      if (data.tenant) upsertLocalTenant(data.tenant);
      await loadFromServer();
      flash(data.message || `已解約 ${storeId}`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "解約失敗");
    } finally {
      setBusySlug(null);
    }
  }

  async function checkout(storeId: string) {
    setBusySlug(storeId);
    try {
      const res = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, simulateSuccess: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "扣款啟動失敗");
      if (data.tenant) upsertLocalTenant(data.tenant);
      await loadFromServer();
      flash(data.message || `已完成首次授權：${storeId}`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "扣款啟動失敗");
    } finally {
      setBusySlug(null);
    }
  }

  async function simulateWebhook(storeId: string, result: "success" | "failed") {
    setBusySlug(storeId);
    try {
      const res = await fetch("/api/webhooks/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, result, mock: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Webhook 失敗");
      if (data.tenant) upsertLocalTenant(data.tenant);
      await loadFromServer();
      flash(data.message || `Webhook ${result}`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Webhook 失敗");
    } finally {
      setBusySlug(null);
    }
  }

  async function issueRenewal(storeId: string) {
    setBusySlug(storeId);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, action: "renew" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "續約產碼失敗");
      if (data.tenant) upsertLocalTenant(data.tenant);
      await loadFromServer();
      flash(
        data.renewUrl
          ? `已寄出續約連結：${data.renewUrl}`
          : `已開立續約：${storeId}`,
      );
    } catch (error) {
      flash(error instanceof Error ? error.message : "續約產碼失敗");
    } finally {
      setBusySlug(null);
    }
  }

  async function deleteTenant(tenant: TenantRecord) {
    const ok = window.confirm(
      `確定刪除「${tenant.name}」（${tenant.slug}）？\n此操作會從總管列表移除，並清除該店內容／訂單資料，無法復原。`,
    );
    if (!ok) return;
    setBusySlug(tenant.storeId);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: tenant.storeId, action: "delete" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "刪除失敗");
      if (Array.isArray(data.tenants)) {
        setTenants(data.tenants);
        replaceTenants(data.tenants);
      } else {
        await loadFromServer();
      }
      flash(data.message || `已刪除 ${tenant.slug}`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "刪除失敗");
    } finally {
      setBusySlug(null);
    }
  }

  async function changePlan(
    storeId: string,
    planType: TenantRecord["planType"],
  ) {
    setBusySlug(storeId);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, action: "change-plan", planType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "升降級失敗");
      if (data.tenant) upsertLocalTenant(data.tenant);
      await loadFromServer();
      flash(data.message || `已更新方案：${storeId}`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "升降級失敗");
    } finally {
      setBusySlug(null);
    }
  }

  async function runCron() {
    setBusySlug("__cron__");
    try {
      const res = await fetch("/api/cron/check-subscriptions", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cron 失敗");
      await loadFromServer();
      flash(`Cron 完成：暫停 ${data.suspendedCount} 家店`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Cron 失敗");
    } finally {
      setBusySlug(null);
    }
  }

  if (!ready) {
    return <div className="min-h-screen animate-pulse bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.12),_transparent_50%)]" />

      <header className="relative border-b border-white/10 bg-slate-900/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size={40} />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-bold text-white">
                <Shield className="h-4 w-4 shrink-0 text-teal-300" />
                總管理後台
              </p>
              <p className="truncate text-xs text-slate-400">
                Super Admin · 訂閱扣款／催繳／自動暫停
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Link href="/dashboard" className="col-span-1 sm:col-auto">
              <Button
                as="span"
                size="sm"
                variant="outline"
                className="w-full border-white/15 bg-transparent text-slate-200 hover:bg-white/10 sm:w-auto"
              >
                <LayoutDashboard className="h-4 w-4" />
                店家後台
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void runCron()}
              disabled={busySlug === "__cron__"}
              className="w-full border-amber-400/30 bg-amber-400/10 text-amber-50 hover:bg-amber-400/20 sm:w-auto"
            >
              <TimerReset className="h-4 w-4" />
              執行 Cron
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadFromServer()}
              className="w-full border-white/15 bg-transparent text-slate-200 hover:bg-white/10 sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              重新整理
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowProvision(true)}
              className="col-span-2 w-full bg-teal-400 text-slate-950 hover:bg-teal-300 sm:col-span-1 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              一鍵創建店家
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl space-y-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        <SiteAnalyticsPanel />
        <AdminBankTransferPanel />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "全部店家", value: stats.total, tone: "text-white" },
            { label: "Active", value: stats.active, tone: "text-emerald-300" },
            { label: "Pending", value: stats.pending, tone: "text-amber-300" },
            {
              label: "Suspended",
              value: stats.suspended,
              tone: "text-rose-300",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-4"
            >
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className={`mt-1 text-2xl font-bold ${item.tone}`}>
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-xl shadow-black/30">
          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
            <h1 className="text-lg font-bold text-white">Tenants 訂閱總表</h1>
            <p className="mt-1 text-sm text-slate-400">
              綠 Active／黃 Pending／紅 Suspended。訂閱採綠界線上付款；可手動覆寫狀態、一鍵產生服務確認單／報價單，或執行每日
              Cron 自動暫停逾期店家。
            </p>
          </div>

          {/* 手機：卡片列表，避免寬表左右拖曳 */}
          <div className="space-y-3 p-3 sm:p-4 lg:hidden">
            {tenants.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
                尚無租戶
              </p>
            ) : (
              tenants.map((tenant) => (
                <article
                  key={tenant.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/stores/${tenant.slug}`}
                        className="block truncate font-semibold text-teal-200 hover:underline"
                      >
                        {tenant.name}
                      </Link>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                        {tenant.storeId}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {tenant.ownerEmail}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(tenant.status)}`}
                    >
                      {tenant.status}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>
                      <dt className="text-slate-500">下次扣款</dt>
                      <dd className="mt-0.5 text-slate-200">
                        {tenant.nextBillingDate
                          ? tenant.nextBillingDate.slice(0, 10)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">流量</dt>
                      <dd className="mt-0.5 tabular-nums text-slate-200">
                        {tenant.pageViews.toLocaleString("zh-TW")}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-500">方案</dt>
                      <dd className="mt-1">
                        <select
                          className="w-full rounded-lg border border-white/15 bg-slate-950 px-2.5 py-2 text-sm text-slate-100"
                          value={tenant.planType}
                          disabled={busySlug === tenant.storeId}
                          onChange={(e) =>
                            void changePlan(
                              tenant.storeId,
                              e.target.value as TenantRecord["planType"],
                            )
                          }
                          aria-label={`${tenant.storeId} 升降級方案`}
                        >
                          {(
                            Object.keys(PLAN_TYPE_LABELS) as Array<
                              TenantRecord["planType"]
                            >
                          ).map((key) => (
                            <option key={key} value={key}>
                              {PLAN_TYPE_LABELS[key]}
                            </option>
                          ))}
                        </select>
                        {tenant.isFoundingMember ? (
                          <span className="mt-1 block text-[11px] text-amber-300/90">
                            創始 8 折
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <TenantActionButtons
                      tenant={tenant}
                      busy={busySlug === tenant.storeId}
                      onCheckout={() => void checkout(tenant.storeId)}
                      onIssueRenewal={() => void issueRenewal(tenant.storeId)}
                      onWebhookSuccess={() =>
                        void simulateWebhook(tenant.storeId, "success")
                      }
                      onWebhookFailed={() =>
                        void simulateWebhook(tenant.storeId, "failed")
                      }
                      onToggleStatus={() =>
                        void patchStatus(
                          tenant.storeId,
                          tenant.status === "Suspended"
                            ? "activate"
                            : "suspend",
                        )
                      }
                      onCancel={() => void cancelSubscription(tenant.storeId)}
                      onDelete={() => void deleteTenant(tenant)}
                    />
                  </div>
                </article>
              ))
            )}
          </div>

          {/* 桌面：完整表格 */}
          <div className="scroll-x-touch hidden overflow-x-auto lg:block">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold sm:px-5">店家名稱</th>
                  <th className="px-4 py-3 font-semibold">store_id</th>
                  <th className="px-4 py-3 font-semibold">plan_type</th>
                  <th className="px-4 py-3 font-semibold">status</th>
                  <th className="px-4 py-3 font-semibold">next_billing_date</th>
                  <th className="px-4 py-3 font-semibold">grace_period_ends_at</th>
                  <th className="px-4 py-3 font-semibold">merchant_member_id</th>
                  <th className="px-4 py-3 font-semibold">流量</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="min-w-0">
                        <Link
                          href={`/stores/${tenant.slug}`}
                          className="font-semibold text-teal-200 hover:underline"
                        >
                          {tenant.name}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {tenant.ownerEmail}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                      {tenant.storeId}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <select
                          className="rounded-md border border-white/15 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                          value={tenant.planType}
                          disabled={busySlug === tenant.storeId}
                          onChange={(e) =>
                            void changePlan(
                              tenant.storeId,
                              e.target.value as TenantRecord["planType"],
                            )
                          }
                          aria-label={`${tenant.storeId} 升降級方案`}
                        >
                          {(
                            Object.keys(PLAN_TYPE_LABELS) as Array<
                              TenantRecord["planType"]
                            >
                          ).map((key) => (
                            <option key={key} value={key}>
                              {PLAN_TYPE_LABELS[key]}
                            </option>
                          ))}
                        </select>
                        {tenant.isFoundingMember ? (
                          <span className="text-[11px] text-amber-300/90">
                            創始 8 折
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(tenant.status)}`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-300">
                      {tenant.nextBillingDate
                        ? tenant.nextBillingDate.slice(0, 10)
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-300">
                      {tenant.gracePeriodEndsAt
                        ? new Date(tenant.gracePeriodEndsAt).toLocaleString(
                            "zh-TW",
                            { hour12: false },
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                      {tenant.merchantMemberId || "—"}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-slate-300">
                      {tenant.pageViews.toLocaleString("zh-TW")}
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="flex max-w-[320px] flex-wrap gap-1.5">
                        <TenantActionButtons
                          tenant={tenant}
                          busy={busySlug === tenant.storeId}
                          onCheckout={() => void checkout(tenant.storeId)}
                          onIssueRenewal={() => void issueRenewal(tenant.storeId)}
                          onWebhookSuccess={() =>
                            void simulateWebhook(tenant.storeId, "success")
                          }
                          onWebhookFailed={() =>
                            void simulateWebhook(tenant.storeId, "failed")
                          }
                          onToggleStatus={() =>
                            void patchStatus(
                              tenant.storeId,
                              tenant.status === "Suspended"
                                ? "activate"
                                : "suspend",
                            )
                          }
                          onCancel={() => void cancelSubscription(tenant.storeId)}
                          onDelete={() => void deleteTenant(tenant)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 text-sm text-slate-400 sm:px-5">
          <p className="flex items-center gap-2 font-medium text-slate-200">
            <Store className="h-4 w-4 text-teal-300" />
            訂閱機制說明
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Schema：store_id / plan_type / status / expires_at／next_billing_date
            </li>
            <li>
              付費：訂閱一律綠界（信用卡／定期定額／ATM／超商）；歷史匯款單僅可於上方面板清掉。
            </li>
            <li>
              Cron：`/api/cron/check-subscriptions` 處理到期暫停與到期前提醒。
            </li>
          </ul>
        </section>
      </main>

      {showProvision ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
          <div className="scroll-y-touch w-full max-w-lg max-h-[min(92dvh,880px)] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">一鍵創建新店家</h2>
                <p className="mt-1 text-sm text-slate-400">
                  寫入訂閱資料庫後，立即產生 /stores/[slug] 預覽連結。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProvision(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="關閉"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ProvisionTenantForm
              onCancel={() => setShowProvision(false)}
              onCreated={async (slug, tenant) => {
                setShowProvision(false);
                if (tenant) {
                  await fetch("/api/admin/tenants", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "upsert", tenant }),
                  });
                  upsertLocalTenant(tenant);
                }
                await loadFromServer();
                flash(`已開通：/stores/${slug}`);
              }}
            />
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/15 bg-slate-900 px-4 py-2 text-sm text-white shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function TenantActionButtons({
  tenant,
  busy,
  onCheckout,
  onIssueRenewal,
  onWebhookSuccess,
  onWebhookFailed,
  onToggleStatus,
  onCancel,
  onDelete,
}: {
  tenant: TenantRecord;
  busy: boolean;
  onCheckout: () => void;
  onIssueRenewal: () => void;
  onWebhookSuccess: () => void;
  onWebhookFailed: () => void;
  onToggleStatus: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Link href={`/admin/quotation/${tenant.storeId}`} target="_blank">
        <Button
          as="span"
          size="sm"
          variant="outline"
          className="h-8 border-sky-400/35 bg-sky-400/10 px-2 text-xs text-sky-50 hover:bg-sky-400/20"
        >
          <FileText className="h-3.5 w-3.5" />
          產生報價單
        </Button>
      </Link>
      <Link href={`/stores/${tenant.slug}`} target="_blank">
        <Button
          as="span"
          size="sm"
          variant="outline"
          className="h-8 border-white/15 bg-transparent px-2 text-xs text-slate-200 hover:bg-white/10"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          前台
        </Button>
      </Link>
      <Link href="/dashboard">
        <Button
          as="span"
          size="sm"
          variant="outline"
          className="h-8 border-white/15 bg-transparent px-2 text-xs text-slate-200 hover:bg-white/10"
        >
          <Settings2 className="h-3.5 w-3.5" />
          後台
        </Button>
      </Link>
      <Link
        href={`/billing/renew?storeId=${encodeURIComponent(tenant.storeId)}`}
        target="_blank"
      >
        <Button
          as="span"
          size="sm"
          variant="outline"
          className="h-8 border-teal-400/30 bg-teal-400/10 px-2 text-xs text-teal-50 hover:bg-teal-400/20"
        >
          <CreditCard className="h-3.5 w-3.5" />
          綠界續費頁
        </Button>
      </Link>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onCheckout}
        className="h-8 border-stone-400/30 bg-stone-400/10 px-2 text-xs text-stone-100"
      >
        模擬綠界開通
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onIssueRenewal}
        className="h-8 border-teal-400/30 bg-teal-400/10 px-2 text-xs text-teal-50"
      >
        寄出續約連結
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onWebhookSuccess}
        className="hidden h-8 border-emerald-400/30 bg-emerald-400/10 px-2 text-xs text-emerald-50"
      >
        扣款成功
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onWebhookFailed}
        className="hidden h-8 border-amber-400/30 bg-amber-400/10 px-2 text-xs text-amber-50"
      >
        扣款失敗
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onToggleStatus}
        className={`h-8 px-2 text-xs ${
          tenant.status === "Suspended"
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
            : "border-rose-400/30 bg-rose-400/10 text-rose-100"
        }`}
      >
        {tenant.status === "Suspended" ? (
          <>
            <PlayCircle className="h-3.5 w-3.5" />
            手動恢復
          </>
        ) : (
          <>
            <PauseCircle className="h-3.5 w-3.5" />
            手動暫停
          </>
        )}
      </Button>
      {!tenant.cancelledAt ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
          className="h-8 border-rose-500/40 bg-rose-500/15 px-2 text-xs text-rose-50"
        >
          <X className="h-3.5 w-3.5" />
          解約停扣
        </Button>
      ) : (
        <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100">
          已解約
        </span>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onDelete}
        className="h-8 border-rose-500/50 bg-rose-600/20 px-2 text-xs text-rose-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        刪除
      </Button>
    </>
  );
}
