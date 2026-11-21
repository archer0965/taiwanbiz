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
import type { StoreProduct } from "@/lib/mock-data";
import { getStoreSettings, saveStoreProducts } from "@/lib/storage";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function ProductsManagerClient() {
  const { slug, content } = useActiveStore();
  const [products, setProducts] = useState<StoreProduct[]>(
    () => getStoreSettings().products,
  );
  const [error, setError] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeToast = useCallback(() => setToastOpen(false), []);

  useEffect(() => {
    if (content?.profile?.products?.length) {
      setProducts(content.profile.products);
    }
  }, [content]);

  function updateProduct(id: string, patch: Partial<StoreProduct>) {
    setProducts((list) =>
      list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addProduct() {
    setProducts((list) => [
      ...list,
      {
        id: `product-${Date.now()}`,
        name: "新服務項目",
        price: 100,
        description: "請填寫服務簡介與時長",
        durationMinutes: 60,
        image:
          "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
      },
    ]);
  }

  function removeProduct(id: string) {
    setProducts((list) => list.filter((item) => item.id !== id));
  }

  async function handleSave() {
    setError("");
    const cleaned = products
      .map((p) => ({
        ...p,
        name: p.name.trim(),
        description: p.description.trim(),
        price: Math.max(0, Number(p.price) || 0),
        image: p.image.trim(),
        durationMinutes: Math.max(
          15,
          Math.min(480, Math.round(Number(p.durationMinutes) || 60)),
        ),
        tags: Array.isArray(p.tags)
          ? p.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
          : [],
      }))
      .filter((p) => p.name);
    if (cleaned.length === 0) {
      setError("請至少保留一項服務後再儲存。");
      return;
    }
    setProducts(cleaned);
    saveStoreProducts(cleaned);
    if (slug) {
      setSaving(true);
      try {
        const res = await fetch(
          `/api/stores/${encodeURIComponent(slug)}/content`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile: { ...(content?.profile || getStoreSettings()), products: cleaned },
              shopProducts:
                content?.mode === "shop"
                  ? cleaned.map((p) => ({
                      ...p,
                      stockStatus: "in_stock" as const,
                      sizes: ["F"],
                      colors: [{ id: "default", name: "預設", swatch: "#0f172a" }],
                    }))
                  : content?.shopProducts || [],
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "伺服器儲存失敗");
      } catch (err) {
        setError(err instanceof Error ? err.message : "儲存失敗");
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }
    setToastOpen(true);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            服務項目管理
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            新增、編輯價格與圖片網址，儲存後前台熱門列表會立刻更新。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={addProduct}
          >
            <Plus className="h-4 w-4" />
            新增項目
          </Button>
          <Link href="/stores/brunch-house">
            <Button as="span" variant="outline" className="w-full sm:w-auto">
              預覽前台
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {products.map((product, index) => (
          <Card key={product.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>項目 {index + 1}</CardTitle>
                <CardDescription>名稱、價格、簡介與圖片</CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeProduct(product.id)}
                disabled={products.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
                刪除
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>名稱</Label>
                <Input
                  value={product.name}
                  onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                />
              </div>
              <div>
                <Label>價格（NT$）</Label>
                <Input
                  type="number"
                  min={0}
                  value={product.price}
                  onChange={(e) =>
                    updateProduct(product.id, { price: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`dur-${product.id}`}>
                  服務時長（分鐘）
                </Label>
                <Input
                  id={`dur-${product.id}`}
                  type="number"
                  min={15}
                  max={480}
                  step={5}
                  value={product.durationMinutes ?? 60}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const next = Number.isFinite(raw)
                      ? Math.max(15, Math.min(480, Math.round(raw)))
                      : 60;
                    updateProduct(product.id, { durationMinutes: next });
                  }}
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[30, 60, 90, 120, 150, 180, 210, 240].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        updateProduct(product.id, { durationMinutes: mins })
                      }
                      className={
                        (product.durationMinutes ?? 60) === mins
                          ? "rounded-md bg-stone-900 px-2 py-0.5 text-[11px] font-semibold text-white"
                          : "rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-50"
                      }
                    >
                      {mins} 分
                      {mins === 210 ? "・燙染" : ""}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-stone-500">
                  可精確輸入 15～480 分鐘（步進 5）。前台會依時長＋緩衝鎖定連續時段，避免美髮撞期。
                </p>
              </div>
              <div>
                <Label>服務標籤 tags（燙染回護）</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(
                    [
                      { id: "perm", label: "燙髮" },
                      { id: "color", label: "染髮" },
                      { id: "cut", label: "剪髮" },
                      { id: "care", label: "護理" },
                    ] as const
                  ).map((tag) => {
                    const on = (product.tags || []).includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          const cur = new Set(product.tags || []);
                          if (on) cur.delete(tag.id);
                          else cur.add(tag.id);
                          updateProduct(product.id, {
                            tags: [...cur],
                          });
                        }}
                        className={
                          on
                            ? "rounded-md bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white"
                            : "rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-600"
                        }
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-stone-500">
                  勾選燙髮／染髮後，完成服務 N 天會自動推播護理回購提醒。
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label>簡介</Label>
                <Textarea
                  value={product.description}
                  onChange={(e) =>
                    updateProduct(product.id, { description: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>圖片網址</Label>
                <Input
                  value={product.image}
                  onChange={(e) => updateProduct(product.id, { image: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      <Button
        size="lg"
        className="h-12 w-full sm:w-auto"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? "儲存中…" : "儲存服務價目表"}
      </Button>
      <Toast
        open={toastOpen}
        onClose={closeToast}
        message="服務價目表已儲存並同步前台！"
      />
    </div>
  );
}

export function ProductsManager() {
  const ready = useClientReady();
  if (!ready) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />;
  return <ProductsManagerClient />;
}
