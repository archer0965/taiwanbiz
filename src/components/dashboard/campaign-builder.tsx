"use client";

import { DemoBuilderCard } from "@/components/dashboard/demo-builder-card";
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
import { Toast } from "@/components/ui/toast";
import {
  buildDefaultBeautyPrizes,
  createPrizeId,
  summarizePrizes,
  totalPrizeQuantity,
  type CampaignPrizeTier,
} from "@/lib/campaign-prizes";
import type { CampaignDraft } from "@/lib/mock-data";
import { DEFAULT_CAMPAIGN } from "@/lib/mock-data";
import { getCampaign, normalizeCampaign, saveCampaign } from "@/lib/storage";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { Check, Copy, Gift, Link2, Plus, QrCode, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

function CampaignBuilderClient() {
  const { slug, content } = useActiveStore();
  const [form, setForm] = useState<CampaignDraft>(() => getCampaign());
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [origin] = useState(() =>
    typeof window !== "undefined"
      ? window.location.origin
      : "https://taiwanbiz.vercel.app",
  );

  useEffect(() => {
    if (content?.campaign) {
      setForm(normalizeCampaign(content.campaign));
    }
  }, [content]);
  const closeToast = useCallback(() => setToastOpen(false), []);

  const campaignUrl = useMemo(
    () => `${origin}/stores/${slug || "nail-studio"}#campaign`,
    [origin, slug],
  );

  const totalQuota = totalPrizeQuantity(form.prizes);

  function updatePrize(
    id: string,
    patch: Partial<Pick<CampaignPrizeTier, "label" | "quantity">>,
  ) {
    setForm((current) => ({
      ...current,
      prizes: current.prizes.map((tier) =>
        tier.id === id ? { ...tier, ...patch } : tier,
      ),
    }));
  }

  function addPrize() {
    setForm((current) => ({
      ...current,
      prizes: [
        ...current.prizes,
        {
          id: createPrizeId(),
          label: "新獎項",
          quantity: 10,
        },
      ],
    }));
  }

  function removePrize(id: string) {
    setForm((current) => ({
      ...current,
      prizes:
        current.prizes.length <= 1
          ? current.prizes
          : current.prizes.filter((tier) => tier.id !== id),
    }));
  }

  /** 將差額補到最後一階（方便設定「其餘 9 折」） */
  function fillRemainderToLast(targetTotal: number) {
    setForm((current) => {
      if (current.prizes.length === 0) return current;
      const others = current.prizes.slice(0, -1);
      const used = totalPrizeQuantity(others);
      const lastQty = Math.max(0, Math.floor(targetTotal) - used);
      const prizes = [
        ...others,
        { ...current.prizes[current.prizes.length - 1], quantity: lastQty },
      ];
      return { ...current, prizes, quota: totalPrizeQuantity(prizes) };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const prizes = form.prizes
      .map((tier) => ({
        ...tier,
        label: tier.label.trim(),
        quantity: Math.max(0, Math.floor(Number(tier.quantity) || 0)),
      }))
      .filter((tier) => tier.label && tier.quantity > 0);

    if (!name || !form.expiresAt) {
      setFormError("請填寫活動名稱與有效期限。");
      return;
    }
    if (prizes.length === 0) {
      setFormError("請至少設定一個獎項，並填寫份數。");
      return;
    }

    const next = normalizeCampaign({
      ...form,
      name,
      prizes,
      prize: summarizePrizes(prizes),
      quota: totalPrizeQuantity(prizes),
    });

    setFormError("");
    const storeKey = slug || "brunch-house";
    const ok = saveCampaign(next, storeKey);
    if (!ok) {
      setFormError("儲存失敗，請檢查瀏覽器儲存空間後再試。");
      return;
    }
    if (slug) {
      try {
        const res = await fetch(
          `/api/stores/${encodeURIComponent(slug)}/content`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaign: next }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "伺服器儲存失敗");
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "伺服器儲存失敗");
        return;
      }
    }
    setForm(next);
    setSaved(true);
    setToastOpen(true);
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(campaignUrl);
      } else {
        const input = document.createElement("input");
        input.value = campaignUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          行銷活動與 Demo 範本
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-stone-500">
          一鍵套用美業 Demo，或自訂刮刮樂多階獎項（如現折
          $100、指緣油體驗、熟客 9 折）。顧客刮中後會引導加入 LINE 領核銷碼。
        </p>
      </div>

      <DemoBuilderCard />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>活動設定</CardTitle>
            <CardDescription>
              設定活動名稱、期限，並新增各折扣／獎項的發放份數
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="campaign-name">活動名稱</Label>
                <Input
                  id="campaign-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="例如：週年慶刮刮樂"
                  required
                />
              </div>

              <div>
                <Label htmlFor="campaign-expires">活動有效期限</Label>
                <Input
                  id="campaign-expires"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expiresAt: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      獎項與份數
                    </p>
                    <p className="text-xs text-stone-500">
                      總份數會自動加總：目前{" "}
                      <span className="font-semibold text-stone-800">
                        {totalQuota}
                      </span>{" "}
                      份
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const prizes = buildDefaultBeautyPrizes();
                        setForm((current) => ({
                          ...current,
                          name: current.name || "開幕刮刮樂・美業回訪禮",
                          prizes,
                          prize: summarizePrizes(prizes),
                          quota: totalPrizeQuantity(prizes),
                        }));
                      }}
                    >
                      套用美業預設獎項
                    </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPrize}
                  >
                    <Plus className="h-4 w-4" />
                    新增獎項
                  </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {form.prizes.map((tier, index) => (
                    <div
                      key={tier.id}
                      className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_110px_auto]"
                    >
                      <div>
                        <Label htmlFor={`prize-label-${tier.id}`}>
                          獎項 {index + 1}
                        </Label>
                        <Input
                          id={`prize-label-${tier.id}`}
                          value={tier.label}
                          onChange={(e) =>
                            updatePrize(tier.id, { label: e.target.value })
                          }
                          placeholder="例如：全品項 7 折"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`prize-qty-${tier.id}`}>份數</Label>
                        <Input
                          id={`prize-qty-${tier.id}`}
                          type="number"
                          min={1}
                          value={tier.quantity}
                          onChange={(e) =>
                            updatePrize(tier.id, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => removePrize(tier.id)}
                          disabled={form.prizes.length <= 1}
                          aria-label="刪除獎項"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="target-total">快速補齊「其餘」份數</Label>
                    <Input
                      id="target-total"
                      type="number"
                      min={1}
                      defaultValue={100}
                      placeholder="目標總份數，例如 100"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById(
                        "target-total",
                      ) as HTMLInputElement | null;
                      const target = Number(input?.value || 100);
                      if (!Number.isFinite(target) || target < 1) {
                        setFormError("請輸入有效的目標總份數");
                        return;
                      }
                      setFormError("");
                      fillRemainderToLast(target);
                    }}
                  >
                    將差額補到最後一階
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  範例：先設 10 份 7 折、10 份 8 折、10 份 85 折、1 份 9
                  折，再輸入 100 並點「補到最後一階」，最後一階會自動變成 70
                  份。
                </p>
              </div>

              {formError && (
                <p className="text-sm text-rose-600" role="alert">
                  {formError}
                </p>
              )}
              <Button type="submit" className="w-full sm:w-auto">
                儲存並生成活動連結
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>即時預覽</CardTitle>
            <CardDescription>顧客刮刮樂前會看到的獎項配置</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-indigo-50 p-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                <Gift className="h-3.5 w-3.5" />
                互動行銷專區
              </div>
              <h3 className="mt-3 text-xl font-bold break-words text-slate-900">
                {form.name || DEFAULT_CAMPAIGN.name}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                總名額 {totalQuota} 份，依剩餘份數隨機抽出獎項
              </p>
              <ul className="mt-4 space-y-2">
                {form.prizes.map((tier) => (
                  <li
                    key={tier.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/85 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-800">
                      {tier.label || "未命名獎項"}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {tier.quantity} 份
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                <div className="rounded-xl bg-white/80 p-3">
                  有效期限
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {form.expiresAt || "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  名額上限
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {totalQuota} 名
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {saved && (
        <Card className="animate-fade-in-up border-indigo-100">
          <CardHeader>
            <CardTitle>專屬活動連結與 QR Code</CardTitle>
            <CardDescription>
              儲存後會重置各獎項剩餘份數；將連結分享至社群或列印 QR Code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <Label>活動連結</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    readOnly
                    value={campaignUrl}
                    className="min-w-0 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopy}
                    className="w-full shrink-0 sm:w-auto"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" /> 已複製
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> 複製連結
                      </>
                    )}
                  </Button>
                </div>
                <a
                  href={campaignUrl}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  <Link2 className="h-4 w-4" />
                  開啟活動頁預覽
                </a>
                <p className="text-xs text-slate-500">
                  獎項配置：{summarizePrizes(form.prizes)}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(campaignUrl)}`}
                    alt="活動 QR Code"
                    width={160}
                    height={160}
                    className="rounded-lg"
                  />
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <QrCode className="h-3.5 w-3.5" />
                  活動 QR Code 預覽
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Toast
        open={toastOpen}
        onClose={closeToast}
        message="行銷活動與多階獎項已儲存，專屬連結與 QR Code 已生成！"
      />
    </div>
  );
}

export function CampaignBuilder() {
  const ready = useClientReady();
  if (!ready) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }
  return <CampaignBuilderClient />;
}
