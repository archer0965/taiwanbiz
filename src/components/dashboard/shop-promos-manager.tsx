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
import { Toast } from "@/components/ui/toast";
import {
  emptyShopPromo,
  formatShopPromoLabel,
  normalizeShopPromo,
  type ShopPromo,
  type ShopPromoType,
} from "@/lib/shop-promos";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function ShopPromosManagerClient() {
  const ready = useClientReady();
  const { slug, content, loading } = useActiveStore();
  const [promos, setPromos] = useState<ShopPromo[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const closeToast = useCallback(() => setToastOpen(false), []);

  useEffect(() => {
    if (content?.shopPromos) {
      setPromos(content.shopPromos.map((p) => normalizeShopPromo(p)));
    }
  }, [content]);

  function updatePromo(id: string, patch: Partial<ShopPromo>) {
    setPromos((list) =>
      list.map((p) => (p.id === id ? normalizeShopPromo({ ...p, ...patch }) : p)),
    );
  }

  function addPromo() {
    setPromos((list) => [...list, emptyShopPromo()]);
  }

  function removePromo(id: string) {
    setPromos((list) => list.filter((p) => p.id !== id));
  }

  async function handleSave() {
    if (!slug) return;
    setError("");
    const cleaned = promos.map((p) => normalizeShopPromo(p)).filter((p) => p.name);
    // 折扣碼不可重複
    const codes = cleaned.map((p) => p.code).filter(Boolean);
    if (new Set(codes).size !== codes.length) {
      setError("折扣碼不可重複");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(slug)}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopPromos: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "儲存失敗");
      setPromos((data.content?.shopPromos || cleaned).map((p: ShopPromo) => normalizeShopPromo(p)));
      setToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return <div className="min-h-[40vh] animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!slug) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>尚無綁定店家</CardTitle>
          <CardDescription>請先完成訂閱開通。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (content?.mode && content.mode !== "shop") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>此功能僅限網拍方案</CardTitle>
          <CardDescription>
            實體店方案請使用「建立活動」設定刮刮樂／優惠券。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/campaigns/new">
            <Button>前往建立活動</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            網拍優惠活動
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            設定折扣碼或自動套用優惠；買家結帳時會直接折抵並寫入訂單。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={addPromo}
          >
            <Plus className="h-4 w-4" />
            新增優惠
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "儲存中…" : "儲存優惠"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="space-y-4">
        {promos.map((promo) => (
          <Card key={promo.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-lg">{promo.name || "未命名優惠"}</CardTitle>
                <CardDescription>
                  {formatShopPromoLabel(promo)}
                  {promo.code ? `・代碼 ${promo.code}` : "・無代碼（自動／全站）"}
                  {promo.autoApply ? "・自動套用" : ""}
                  {promo.active ? "" : "・已停用"}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => removePromo(promo.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>活動名稱</Label>
                <Input
                  className="mt-1.5"
                  value={promo.name}
                  onChange={(e) => updatePromo(promo.id, { name: e.target.value })}
                />
              </div>
              <div>
                <Label>折扣碼（選填）</Label>
                <Input
                  className="mt-1.5 uppercase"
                  value={promo.code}
                  placeholder="例：PULSE10"
                  onChange={(e) =>
                    updatePromo(promo.id, { code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div>
                <Label>類型</Label>
                <select
                  className="mt-1.5 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={promo.type}
                  onChange={(e) =>
                    updatePromo(promo.id, {
                      type: e.target.value as ShopPromoType,
                    })
                  }
                >
                  <option value="percent">百分比折扣</option>
                  <option value="fixed">固定金額折抵</option>
                  <option value="free_shipping">免運費</option>
                </select>
              </div>
              {promo.type !== "free_shipping" ? (
                <div>
                  <Label>
                    {promo.type === "percent" ? "折扣 %" : "折抵金額（元）"}
                  </Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={1}
                    value={promo.value}
                    onChange={(e) =>
                      updatePromo(promo.id, { value: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              ) : (
                <div className="text-sm text-slate-500 sm:pt-8">
                  免運會將結帳運費設為 0（仍可能需綠界物流帳戶餘額建單）。
                </div>
              )}
              <div>
                <Label>最低消費（元）</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={0}
                  value={promo.minSubtotal}
                  onChange={(e) =>
                    updatePromo(promo.id, {
                      minSubtotal: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>使用上限（張／次，空白＝不限）</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={1}
                  value={promo.usageLimit ?? ""}
                  placeholder="不限"
                  onChange={(e) =>
                    updatePromo(promo.id, {
                      usageLimit: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
                <p className="mt-1 text-xs text-slate-400">
                  已使用 {promo.usedCount || 0} 次
                </p>
              </div>
              <div>
                <Label>開始日（選填）</Label>
                <Input
                  className="mt-1.5"
                  type="date"
                  value={(promo.startsAt || "").slice(0, 10)}
                  onChange={(e) =>
                    updatePromo(promo.id, {
                      startsAt: e.target.value
                        ? `${e.target.value}T00:00:00.000Z`
                        : null,
                    })
                  }
                />
              </div>
              <div>
                <Label>結束日（選填）</Label>
                <Input
                  className="mt-1.5"
                  type="date"
                  value={(promo.endsAt || "").slice(0, 10)}
                  onChange={(e) =>
                    updatePromo(promo.id, {
                      endsAt: e.target.value
                        ? `${e.target.value}T23:59:59.999Z`
                        : null,
                    })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={promo.active}
                  onChange={(e) =>
                    updatePromo(promo.id, { active: e.target.checked })
                  }
                />
                啟用中
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={promo.autoApply}
                  onChange={(e) =>
                    updatePromo(promo.id, { autoApply: e.target.checked })
                  }
                />
                結帳自動套用（符合門檻時）
              </label>
            </CardContent>
          </Card>
        ))}
        {promos.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500">
              尚未建立優惠。點「新增優惠」開始設定，例如全館 9 折或折扣碼免運。
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Toast
        open={toastOpen}
        onClose={closeToast}
        message="已儲存優惠活動，前台結帳將自動套用並寫入訂單。"
      />
    </div>
  );
}

export function ShopPromosManager() {
  return <ShopPromosManagerClient />;
}
