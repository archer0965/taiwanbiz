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
import { isSafeHttpUrl } from "@/lib/safe-url";
import {
  getStoreSettings,
  saveStoreSettings,
  type StoreSettings,
} from "@/lib/storage";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

function StoreSettingsClient() {
  const { slug, content } = useActiveStore();
  const [settings, setSettings] = useState<StoreSettings>(() => getStoreSettings());
  const [error, setError] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeToast = useCallback(() => setToastOpen(false), []);

  useEffect(() => {
    if (content?.profile) setSettings(content.profile);
  }, [content]);

  function update<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!settings.name.trim()) {
      setError("請填寫店名");
      return;
    }
    const urlFields = [
      settings.mapUrl,
      settings.lineUrl,
      settings.banner,
      settings.facebookUrl,
      settings.instagramUrl,
    ].filter(Boolean);
    if (urlFields.some((url) => !isSafeHttpUrl(url))) {
      setError("地圖、LINE、Banner 與社群連結請使用 http(s) 網址");
      return;
    }
    const next = {
      ...settings,
      name: settings.name.trim(),
      category: settings.category.trim(),
      tagline: settings.tagline.trim(),
      description: settings.description.trim(),
    };
    saveStoreSettings(next);
    if (slug) {
      setSaving(true);
      try {
        const res = await fetch(
          `/api/stores/${encodeURIComponent(slug)}/content`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile: next }),
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
            店家資料設定
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            內容會寫入伺服器，訪客即可在前台看到更新
            {slug ? `（/stores/${slug}）` : ""}。
          </p>
        </div>
        <Link href={slug ? `/stores/${slug}` : "/stores/brunch-house"}>
          <Button as="span" variant="outline">
            預覽前台效果
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>品牌與介紹</CardTitle>
            <CardDescription>影響前台頁首與店家介紹文案</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">店名</Label>
              <Input id="name" value={settings.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="category">店家類型</Label>
              <Input id="category" value={settings.category} onChange={(e) => update("category", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="accent">主題色</Label>
              <select
                id="accent"
                value={settings.accent}
                onChange={(e) => update("accent", e.target.value as StoreSettings["accent"])}
                className="mt-1.5 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="emerald">Emerald</option>
                <option value="rose">Rose</option>
                <option value="amber">Amber</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="tagline">一句話標語</Label>
              <Input id="tagline" value={settings.tagline} onChange={(e) => update("tagline", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">店家介紹</Label>
              <Textarea
                id="description"
                value={settings.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="banner">Banner 圖片網址</Label>
              <Input id="banner" value={settings.banner} onChange={(e) => update("banner", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="welcomeMessage">歡迎訊息</Label>
              <Input
                id="welcomeMessage"
                value={settings.welcomeMessage}
                onChange={(e) => update("welcomeMessage", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="announcement">公告</Label>
              <Input
                id="announcement"
                value={settings.announcement}
                onChange={(e) => update("announcement", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>聯絡與營業資訊</CardTitle>
            <CardDescription>電話、地址、地圖與社群連結（預約通知會寄至下方 Email）</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">電話</Label>
              <Input id="phone" value={settings.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email（新預約接單通知）</Label>
              <Input id="email" value={settings.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="hours">營業時間</Label>
              <Input id="hours" value={settings.hours} onChange={(e) => update("hours", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">地址</Label>
              <Input id="address" value={settings.address} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="mapUrl">Google 地圖連結</Label>
              <Input id="mapUrl" value={settings.mapUrl} onChange={(e) => update("mapUrl", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="lineUrl">LINE 官方帳號連結</Label>
              <Input id="lineUrl" value={settings.lineUrl} onChange={(e) => update("lineUrl", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="facebookUrl">Facebook 連結</Label>
              <Input id="facebookUrl" value={settings.facebookUrl} onChange={(e) => update("facebookUrl", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="instagramUrl">Instagram 連結</Label>
              <Input id="instagramUrl" value={settings.instagramUrl} onChange={(e) => update("instagramUrl", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>前台模組開關</CardTitle>
            <CardDescription>決定前台顯示哪些互動區塊</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["showCampaign", "刮刮樂活動"],
                ["showContactForm", "聯絡表單"],
                ["showMapButton", "地圖按鈕"],
                ["showLineButton", "LINE 按鈕"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={Boolean(settings[key])}
                  onChange={(e) => update(key, e.target.checked)}
                />
                <span className="font-medium text-slate-800">{label}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={saving}>
          {saving ? "儲存中…" : "儲存店家設定"}
        </Button>
      </form>
      <Toast open={toastOpen} onClose={closeToast} message="店家設定已儲存並同步前台！" />
    </div>
  );
}

export function StoreSettingsForm() {
  const ready = useClientReady();
  if (!ready) {
    return <div className="min-h-[240px] animate-pulse rounded-2xl bg-slate-100" />;
  }
  return <StoreSettingsClient />;
}
