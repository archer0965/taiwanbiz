"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logisticsStatusLabel } from "@/lib/logistics-status";
import { formatTwd } from "@/lib/pricing";
import type { ShopOrder, ShopOrderStatus } from "@/lib/store-content";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STATUS_LABEL: Record<ShopOrderStatus, string> = {
  pending_payment: "待付款",
  paid: "已付款",
  preparing: "備貨中",
  shipped: "已發貨",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款",
};

const PAYMENT_LABEL: Record<ShopOrder["payment"], string> = {
  credit: "信用卡",
  atm: "ATM",
  cod: "貨到付款",
};

const PICKUP_LABEL: Record<ShopOrder["pickup"], string> = {
  "711": "7-11",
  family: "全家",
  home: "宅配",
};

function submitPrintForm(
  action: string,
  params: Record<string, string>,
  targetWin?: Window | null,
) {
  const winName = "ecpay-label";
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.acceptCharset = "UTF-8";
  form.target = targetWin && !targetWin.closed ? winName : "_blank";
  form.style.display = "none";
  for (const [key, value] of Object.entries(params)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

/** 必須在 click 當下同步開窗，否則 iOS／Safari 會擋掉非同步後的 window.open */
function openPrintWindowSync() {
  return window.open("about:blank", "ecpay-label", "width=900,height=720");
}

function OrdersManagerClient() {
  const ready = useClientReady();
  const { slug, tenant, loading } = useActiveStore();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    const res = await fetch(
      `/api/shop/orders?storeSlug=${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "無法載入訂單");
      return;
    }
    setOrders(data.orders || []);
    setError("");
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(orderId: string, status: ShopOrderStatus) {
    setBusyId(orderId);
    setHint("");
    try {
      const res = await fetch("/api/shop/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeSlug: slug, orderId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新失敗");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyId(null);
    }
  }

  async function createLogistics(orderId: string, autoPrint: boolean) {
    setBusyId(orderId);
    setError("");
    setHint("");
    // 先開列印視窗（同步），再 await API，避免被瀏覽器擋彈窗
    const printWin = autoPrint ? openPrintWindowSync() : null;
    try {
      const res = await fetch("/api/shop/logistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          storeSlug: slug,
          orderId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        print?: { action: string; params: Record<string, string> };
      };
      if (!res.ok || !data.ok) {
        if (printWin && !printWin.closed) printWin.close();
        throw new Error(data.error || "建立物流單失敗");
      }
      setHint(data.message || "物流單已建立");
      await load();
      if (autoPrint && data.print?.action && data.print.params) {
        if (printWin && !printWin.closed) {
          try {
            printWin.document.write(
              "<p style='font-family:sans-serif;padding:16px'>正在開啟託運單…</p>",
            );
          } catch {
            // cross-origin / closed
          }
        }
        submitPrintForm(data.print.action, data.print.params, printWin);
      } else if (printWin && !printWin.closed) {
        printWin.close();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "建立物流單失敗";
      setError(message);
      window.alert(message);
      requestAnimationFrame(() => {
        document.getElementById("orders-error")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    } finally {
      setBusyId(null);
    }
  }

  async function printLabel(orderId: string) {
    setBusyId(orderId);
    setError("");
    setHint("");
    const printWin = openPrintWindowSync();
    try {
      const res = await fetch("/api/shop/logistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "print",
          storeSlug: slug,
          orderId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        action?: string;
        params?: Record<string, string>;
      };
      if (!res.ok || !data.ok || !data.action || !data.params) {
        if (printWin && !printWin.closed) printWin.close();
        throw new Error(data.error || "無法列印託運單");
      }
      setHint(data.message || "已開啟列印");
      submitPrintForm(data.action, data.params, printWin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "列印失敗";
      setError(message);
      window.alert(message);
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const rows = [
      [
        "訂單編號",
        "建立時間",
        "狀態",
        "顧客",
        "手機",
        "小計",
        "折抵",
        "優惠",
        "應付",
        "抽成",
        "手續費估",
        "應撥",
        "取貨",
        "付款",
        "物流單號",
      ],
      ...orders.map((o) => [
        o.id,
        o.createdAt,
        STATUS_LABEL[o.status],
        o.customerName,
        o.customerPhone,
        String(o.subtotal),
        String(o.discountAmount || 0),
        o.promoName || o.promoCode || "",
        String(o.totalAmount ?? o.subtotal),
        String(o.commissionAmount),
        String(o.paymentFeeEstimate),
        String(o.payoutAmount),
        PICKUP_LABEL[o.pickup] || o.pickup,
        PAYMENT_LABEL[o.payment] || o.payment,
        o.logisticsId || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready || loading) {
    return <div className="min-h-[40vh] animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!slug) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>尚無綁定店家</CardTitle>
          <CardDescription>
            請請總管理員於後台開通並填入您的 Email。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            訂單管理
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {tenant?.name || slug}
            ・建立出貨單後狀態會標為已發貨；到店／取件完成由綠界物流自動更新。請先於店家設定填好寄件手機。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void load()}
          >
            重新整理
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={exportCsv}
          >
            匯出 CSV
          </Button>
          <Link href={`/stores/${slug}`} className="col-span-2 sm:col-span-1">
            <Button as="span" variant="outline" className="w-full sm:w-auto">
              前台
            </Button>
          </Link>
        </div>
      </div>

      {error ? (
        <p
          id="orders-error"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {hint}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>訂單列表</CardTitle>
          <CardDescription>
            共 {orders.length} 筆・有物流單的訂單由綠界貨態自動更新（到店／取件完成）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">尚無訂單</p>
          ) : (
            orders.map((order) => {
              const cvs =
                order.pickup === "711" || order.pickup === "family";
              const canShip =
                cvs &&
                (order.payment === "cod"
                  ? ["preparing", "shipped", "paid"].includes(order.status)
                  : ["paid", "preparing", "shipped"].includes(order.status));
              const hasLogistics = Boolean(order.logisticsId);
              const logisticsLabel = logisticsStatusLabel(order.logisticsStatus);
              return (
                <article
                  key={order.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs font-semibold text-slate-900">
                        {order.id}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleString("zh-TW")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {STATUS_LABEL[order.status]}
                      </span>
                      {logisticsLabel ? (
                        <span className="rounded-md bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-800">
                          {logisticsLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {order.customerPhone}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {PICKUP_LABEL[order.pickup] || order.pickup} /{" "}
                        {PAYMENT_LABEL[order.payment] || order.payment}
                        {order.storeName ? `・${order.storeName}` : ""}
                      </p>
                      {hasLogistics ? (
                        <p className="mt-1 break-all font-mono text-[11px] text-teal-700">
                          物流 {order.logisticsId}
                          {order.cvsPaymentNo
                            ? `・便碼 ${order.cvsPaymentNo}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="sm:text-right">
                      <p className="text-base font-semibold text-slate-900">
                        {formatTwd(order.totalAmount ?? order.subtotal)}
                      </p>
                      {(order.discountAmount || 0) > 0 || order.promoName ? (
                        <p className="text-xs text-emerald-700">
                          優惠
                          {order.promoName ? `「${order.promoName}」` : ""}
                          {(order.discountAmount || 0) > 0
                            ? ` −${formatTwd(order.discountAmount || 0)}`
                            : ""}
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        小計 {formatTwd(order.subtotal)}
                        {(order.shippingFee || 0) > 0
                          ? `・運費 ${formatTwd(order.shippingFee || 0)}`
                          : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        抽成 {formatTwd(order.commissionAmount)}・應撥{" "}
                        {formatTwd(order.payoutAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {canShip && !hasLogistics ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === order.id}
                        onClick={() => void createLogistics(order.id, true)}
                        className="h-9"
                      >
                        建立出貨單並列印
                      </Button>
                    ) : null}
                    {canShip && hasLogistics ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === order.id}
                        onClick={() => void printLabel(order.id)}
                        className="h-9"
                      >
                        列印託運單
                      </Button>
                    ) : null}
                    {!hasLogistics &&
                    (order.status === "paid" ||
                      order.status === "preparing") ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === order.id}
                          onClick={() => void setStatus(order.id, "preparing")}
                          className="h-9"
                        >
                          備貨中
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === order.id}
                          onClick={() => void setStatus(order.id, "shipped")}
                          className="h-9"
                        >
                          已發貨
                        </Button>
                      </>
                    ) : null}
                    {!hasLogistics && order.status === "shipped" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === order.id}
                        onClick={() => void setStatus(order.id, "completed")}
                        className="h-9"
                      >
                        完成
                      </Button>
                    ) : null}
                    {hasLogistics && order.status !== "completed" ? (
                      <p className="w-full text-xs text-slate-500">
                        已串接綠界物流：交寄／到店會標示「已發貨」，買家取件後自動「完成」
                        {order.payment === "cod" ? "並記入收款" : ""}。
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function OrdersManager() {
  return <OrdersManagerClient />;
}
