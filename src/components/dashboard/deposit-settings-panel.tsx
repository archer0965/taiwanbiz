"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import {
  DEPOSIT_MODE_LABELS,
  defaultDepositSettings,
  ECPAY_DEPOSIT_MODULE_ENABLED,
  normalizeDepositSettings,
  type DepositPaymentMode,
  type DepositSettings,
} from "@/lib/deposit-settings";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

/** 實際可切換的金流（綠界僅展示、鎖定） */
const ACTIVE_MODES: DepositPaymentMode[] = ["none", "bank_transfer"];

function DepositSettingsClient() {
  const { slug } = useActiveStore();
  const [settings, setSettings] = useState<DepositSettings>(() =>
    defaultDepositSettings(),
  );
  const [saving, setSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const closeToast = useCallback(() => setToastOpen(false), []);

  useEffect(() => {
    if (!slug) return;
    void fetch(`/api/stores/${encodeURIComponent(slug)}/content`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { content?: { depositSettings?: DepositSettings } }) => {
        setSettings(normalizeDepositSettings(data.content?.depositSettings));
      })
      .catch(() => undefined);
  }, [slug]);

  async function save() {
    if (!slug) return;
    setSaving(true);
    try {
      // 強制寫入預留欄位：deposit_enabled=false、綠界憑證可空
      const next = normalizeDepositSettings({
        ...settings,
        depositEnabled: false,
        mode: settings.mode === "ecpay" ? "none" : settings.mode,
        depositAmount: settings.fixedAmount,
      });
      const res = await fetch(
        `/api/stores/${encodeURIComponent(slug)}/content`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            depositSettings: next,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "儲存失敗");
      setSettings(next);
      setToastMsg("訂金設定已儲存");
      setToastOpen(true);
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "儲存失敗");
      setToastOpen(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>雙軌金流／訂金開關</CardTitle>
        <CardDescription>
          預設為免訂金或手動銀行轉帳。綠界／LINE Pay
          預付訂金已預留資料欄位，模組審核通過後再開放。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTIVE_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, mode }))}
              className={cn(
                "rounded-xl border px-3 py-3 text-left text-sm transition",
                settings.mode === mode
                  ? "border-teal-600 bg-teal-50 text-teal-950 ring-1 ring-teal-500"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300",
              )}
            >
              <span className="block font-semibold">
                【{DEPOSIT_MODE_LABELS[mode]}】
              </span>
              <span className="mt-1 block text-[11px] text-stone-500">
                {mode === "none"
                  ? "線上僅保留時段，費用現場結帳"
                  : "顧客匯款後回填後五碼，店家對帳"}
              </span>
            </button>
          ))}
        </div>

        {/* 預留：綠界／LINE Pay — 鎖定 Disabled */}
        <div
          aria-disabled="true"
          className="relative rounded-xl border border-dashed border-stone-300 bg-stone-50/80 px-3 py-3 text-left text-sm opacity-80"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-stone-600">
                {DEPOSIT_MODE_LABELS.ecpay}
              </p>
              <p className="mt-1 text-[11px] text-stone-500">
                資料欄位已預留（deposit_enabled / deposit_amount /
                ecpay_merchant_id / hash_key / hash_iv）；目前暫不開放。
              </p>
            </div>
            <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-900">
              金流模組審核中 ( Coming Soon )
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled
              className="relative h-7 w-12 cursor-not-allowed rounded-full bg-stone-300"
              aria-label="綠界預付訂金（已停用）"
              title="暫不開放"
            >
              <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow" />
            </button>
            <span className="text-xs font-medium text-stone-500">
              Disabled · deposit_enabled = false
            </span>
          </div>
          {!ECPAY_DEPOSIT_MODULE_ENABLED ? (
            <p className="mt-2 text-[11px] text-stone-400">
              前台預約不會觸發 ECPay SDK／線上刷卡，維持輕量完成預約。
            </p>
          ) : null}
        </div>

        {settings.mode === "bank_transfer" ? (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm",
                  settings.amountType === "fixed"
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200",
                )}
                onClick={() =>
                  setSettings((s) => ({ ...s, amountType: "fixed" }))
                }
              >
                固定金額
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm",
                  settings.amountType === "percent"
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200",
                )}
                onClick={() =>
                  setSettings((s) => ({ ...s, amountType: "percent" }))
                }
              >
                服務金額％
              </button>
            </div>
            {settings.amountType === "fixed" ? (
              <div>
                <Label>訂金金額（元）</Label>
                <Input
                  className="mt-1 max-w-xs"
                  type="number"
                  min={0}
                  value={settings.fixedAmount}
                  onChange={(e) => {
                    const n = Number(e.target.value) || 0;
                    setSettings((s) => ({
                      ...s,
                      fixedAmount: n,
                      depositAmount: n,
                    }));
                  }}
                />
              </div>
            ) : (
              <div className="grid max-w-md gap-3 sm:grid-cols-2">
                <div>
                  <Label>百分比</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    max={100}
                    value={settings.percent}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        percent: Number(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>最低訂金</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    value={settings.minAmount || 0}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        minAmount: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            )}
            <div>
              <Label>匯款說明</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={settings.bankHint || ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, bankHint: e.target.value }))
                }
                placeholder="銀行／帳號／戶名提示…"
              />
            </div>
          </>
        ) : null}

        <Button
          type="button"
          disabled={saving || !slug}
          className="bg-teal-700 hover:bg-teal-800"
          onClick={() => void save()}
        >
          {saving ? "儲存中…" : "儲存訂金設定"}
        </Button>
      </CardContent>
      <Toast open={toastOpen} onClose={closeToast} message={toastMsg} />
    </Card>
  );
}

export function DepositSettingsPanel() {
  const ready = useClientReady();
  if (!ready) {
    return (
      <div className="min-h-[120px] animate-pulse rounded-2xl bg-stone-100" />
    );
  }
  return <DepositSettingsClient />;
}
