"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import type { LeadRecord } from "@/lib/mock-data";
import { isDeveloperEmail } from "@/lib/roles";
import {
  getContactSubmissions,
  getLeads,
  getStats,
  getStoreSettings,
  updateLeadStatus,
  type ContactSubmission,
} from "@/lib/storage";
import { SellerNotificationsPanel } from "@/components/dashboard/seller-notifications-panel";
import {
  daysUntilExpiry,
  formatSellerSubscriptionStatus,
  isTenantBookingSuspended,
  PLAN_TYPE_LABELS,
  resolveSubscriptionLifecycleStatus,
  type TenantRecord,
} from "@/lib/tenants";
import { useClientReady } from "@/lib/use-client-ready";
import { downloadCsv, formatDateTime } from "@/lib/utils";
import {
  Download,
  Eye,
  MessageSquareText,
  Ticket,
  Users,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function StatusBadge({ status }: { status: LeadRecord["status"] }) {
  return (
    <span
      className={
        status === "已兌換"
          ? "rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
          : "rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
      }
    >
      {status}
    </span>
  );
}

function DashboardHomeClient() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const isAdmin = isDeveloperEmail(email);
  const [stats, setStats] = useState(() => getStats());
  const [leads, setLeads] = useState<LeadRecord[]>(() => getLeads());
  const [contacts, setContacts] = useState<ContactSubmission[]>(() =>
    getContactSubmissions(),
  );
  const [settings, setSettings] = useState(() => getStoreSettings());
  const [owned, setOwned] = useState<TenantRecord[]>([]);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const closeToast = useCallback(() => setToastOpen(false), []);

  useEffect(() => {
    function sync() {
      setStats(getStats());
      setLeads(getLeads());
      setContacts(getContactSubmissions());
      setSettings(getStoreSettings());
    }
    sync();
    window.addEventListener("taiwanbiz-storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("taiwanbiz-storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!email) {
      setOwned([]);
      return;
    }
    let cancelled = false;
    void fetch("/api/stores/mine", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const tenants = (data.tenants || []) as TenantRecord[];
        setOwned(isDeveloperEmail(email) ? [] : tenants);
        const first = tenants[0];
        if (first && data.contents?.[0]?.profile) {
          setSettings(data.contents[0].profile);
        }
        if (data.contents?.[0]?.leads) {
          setLeads(data.contents[0].leads);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [email]);

  function handleExport() {
    const rows = [
      ["填寫時間", "顧客手機", "參與活動名稱", "抽中獎項", "兌換序號", "兌換狀態"],
      ...leads.map((lead) => [
        formatDateTime(lead.createdAt),
        lead.phone,
        lead.campaignName,
        lead.prizeLabel || "—",
        lead.couponCode,
        lead.status,
      ]),
    ];
    downloadCsv(
      `拓脈-顧客名單-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
    setToastMsg("顧客名單 CSV 已開始下載");
    setToastOpen(true);
  }

  function toggleStatus(id: string, current: LeadRecord["status"]) {
    const next = current === "未兌換" ? "已兌換" : "未兌換";
    const result = updateLeadStatus(id, next);
    setLeads(result.leads);
    if (!result.ok) {
      setToastMsg("更新失敗，請檢查瀏覽器儲存空間後再試");
      setToastOpen(true);
      return;
    }
    setStats(getStats());
    setToastMsg(`已更新兌換狀態為「${next}」`);
    setToastOpen(true);
  }

  const cards = [
    {
      label: "今日瀏覽人次",
      value: stats.todayViews,
      icon: Eye,
      tone: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "已發出優惠券張數",
      value: stats.couponsIssued,
      icon: Ticket,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "累積顧客名單 (Lead)",
      value: stats.totalLeads,
      icon: Users,
      tone: "text-slate-700 bg-slate-100",
    },
    {
      label: "聯絡表單訊息",
      value: contacts.length,
      icon: MessageSquareText,
      tone: "text-amber-700 bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {email ? <SellerNotificationsPanel /> : null}
      {!isAdmin && owned.length > 0 ? (
        <div className="space-y-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            您以店主身分登入，僅能管理綁定店家：
            {owned.map((tenant) => (
              <span key={tenant.id} className="ml-1 font-semibold">
                {tenant.name}（{PLAN_TYPE_LABELS[tenant.planType]}・
                <Link
                  href={`/stores/${tenant.slug}`}
                  className="underline underline-offset-2"
                >
                  /stores/{tenant.slug}
                </Link>
                ）
              </span>
            ))}
            。可編輯店家資料、服務項目與刮刮樂活動。
          </div>
          {owned.map((tenant) => {
            const life = resolveSubscriptionLifecycleStatus(tenant);
            const daysLeft = daysUntilExpiry(tenant);
            const bookingPaused = isTenantBookingSuspended(tenant);
            const statusText = formatSellerSubscriptionStatus(tenant);
            return (
              <div
                key={`sub-${tenant.id}`}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
              >
                訂閱狀態：
                <span className="ml-1 font-semibold text-stone-900">
                  {statusText}
                </span>
                <span className="mt-1 block text-xs text-stone-500">
                  {tenant.status === "Pending"
                    ? "pending_review"
                    : `subscriptions.status = ${life}`}
                  {typeof daysLeft === "number"
                    ? `・距離到期 ${daysLeft} 天`
                    : ""}
                </span>
                {tenant.status === "Pending" ? (
                  <span className="mt-1 block text-xs text-amber-800">
                    請至「訂閱付款」以綠界完成線上付款開通。
                  </span>
                ) : null}
                {bookingPaused ? (
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-rose-800">
                    前台已顯示「系統維護／方案已到期暫停預約」。
                    <Link
                      href="/dashboard/billing"
                      className="font-semibold underline underline-offset-2"
                    >
                      立即續費
                    </Link>
                  </span>
                ) : null}
                {!bookingPaused &&
                typeof daysLeft === "number" &&
                daysLeft >= 0 &&
                daysLeft <= 3 ? (
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-900">
                    方案將於 {daysLeft} 天內到期，請儘速續費以免暫停預約。
                    <Link
                      href="/dashboard/billing"
                      className="font-semibold underline underline-offset-2"
                    >
                      前往續費
                    </Link>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {!isAdmin && email && owned.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          目前 Email（{email}）尚未綁定任何店家。請請總管理員於「總管理後台」開通並填入您的
          Email，或使用示範帳號 owner.nail@demo.tw 登入。
        </div>
      ) : null}
      {isAdmin ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          您是總管理員。可前往{" "}
          <Link
            href="/admin/dashboard"
            className="font-semibold text-indigo-700 underline-offset-2 hover:underline"
          >
            總管理後台
          </Link>{" "}
          一鍵開通店家、暫停未付款租戶。
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {owned[0]?.name || settings.name}・數據總覽
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            掌握發券、名單與前台留言。正式通知會同步寄到您的 Gmail。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Link href="/dashboard/store">
            <Button as="span" variant="outline" className="w-full sm:w-auto">
              編輯店家資料
            </Button>
          </Link>
          <Link href="/dashboard/style">
            <Button as="span" variant="outline" className="w-full sm:w-auto">
              網站風格
            </Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button as="span" variant="outline" className="w-full sm:w-auto">
              訂單管理
            </Button>
          </Link>
          <Link href="/dashboard/products">
            <Button as="span" variant="outline" className="w-full sm:w-auto">
              管理服務項目
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4 p-4 sm:p-5">
              <div className={`rounded-2xl p-3 ${card.tone}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">
                  {card.value.toLocaleString("zh-TW")}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>目前前台設定摘要</CardTitle>
          <CardDescription>快速確認可控制項目狀態</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <p>主題色：{settings.accent}</p>
          <p>營業時間：{settings.hours}</p>
          <p>地址：{settings.address}</p>
          <p>服務項目數：{settings.products.length}</p>
          <p>刮刮樂模組：{settings.showCampaign ? "開啟" : "關閉"}</p>
          <p>聯絡表單：{settings.showContactForm ? "開啟" : "關閉"}</p>
          <p>地圖按鈕：{settings.showMapButton ? "開啟" : "關閉"}</p>
          <p>LINE 按鈕：{settings.showLineButton ? "開啟" : "關閉"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>前台聯絡留言</CardTitle>
          <CardDescription>
            訪客從店家頁送出的訊息；同時會寄信通知您
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-slate-500">尚無聯絡留言</p>
          ) : (
            <div className="space-y-3">
              {contacts.slice(0, 20).map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDateTime(item.createdAt)} · {item.phone}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                    {item.message}
                  </p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>顧客名單列表</CardTitle>
            <CardDescription>
              可點擊狀態切換「未兌換／已兌換」，並匯出 CSV
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            className="w-full sm:w-auto"
            disabled={leads.length === 0}
          >
            <Download className="h-4 w-4" />
            匯出 CSV
          </Button>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-sm text-slate-500">
              尚無領券名單。顧客於前台刮刮樂領取後會顯示於此，並寄信通知您。
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {leads.map((lead) => (
                  <article
                    key={lead.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {lead.phone}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDateTime(lead.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleStatus(lead.id, lead.status)}
                      >
                        <StatusBadge status={lead.status} />
                      </button>
                    </div>
                    <p className="mt-3 text-sm break-words text-slate-700">
                      {lead.campaignName}
                    </p>
                    {lead.prizeLabel && (
                      <p className="mt-1 text-sm font-medium text-emerald-700">
                        抽中：{lead.prizeLabel}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-xs tracking-wide text-slate-500">
                      {lead.couponCode}
                    </p>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">填寫時間</th>
                      <th className="px-4 py-3 font-medium">顧客手機</th>
                      <th className="px-4 py-3 font-medium">參與活動名稱</th>
                      <th className="px-4 py-3 font-medium">抽中獎項</th>
                      <th className="px-4 py-3 font-medium">兌換序號</th>
                      <th className="px-4 py-3 font-medium">兌換狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="border-t border-slate-100 text-slate-700"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDateTime(lead.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">
                          {lead.phone}
                        </td>
                        <td className="px-4 py-3">{lead.campaignName}</td>
                        <td className="px-4 py-3">{lead.prizeLabel || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                          {lead.couponCode}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleStatus(lead.id, lead.status)}
                            className="hover:opacity-80"
                          >
                            <StatusBadge status={lead.status} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Toast open={toastOpen} onClose={closeToast} message={toastMsg} />
    </div>
  );
}

export function DashboardHome() {
  const ready = useClientReady();
  if (!ready) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }
  return <DashboardHomeClient />;
}
