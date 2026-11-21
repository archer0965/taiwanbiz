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
  STORE_STYLE_FONT_LABELS,
  STORE_STYLE_MOOD_LABELS,
  STORE_STYLE_PALETTE_LABELS,
  STORE_STYLE_RADIUS_LABELS,
  defaultStoreStyle,
  normalizeStoreStyle,
  paletteSwatch,
  storeStyleCssVars,
  storeStyleToAccent,
  storeStyleToTheme,
  type StoreStyleFont,
  type StoreStyleMood,
  type StoreStylePalette,
  type StoreStyleRadius,
  type StoreStyleSettings,
} from "@/lib/store-style";
import { useActiveStore } from "@/lib/use-active-store";
import { useClientReady } from "@/lib/use-client-ready";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function StyleStudioClient() {
  const { slug, content } = useActiveStore();
  const [style, setStyle] = useState<StoreStyleSettings>(() =>
    defaultStoreStyle("rose"),
  );
  const [saving, setSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [error, setError] = useState("");
  const closeToast = useCallback(() => setToastOpen(false), []);

  useEffect(() => {
    if (!slug) return;
    void fetch(`/api/stores/${encodeURIComponent(slug)}/content`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then(
        (data: {
          content?: {
            storeStyle?: StoreStyleSettings;
            profile?: { accent?: string };
          };
        }) => {
          setStyle(
            normalizeStoreStyle(
              data.content?.storeStyle,
              data.content?.profile?.accent,
            ),
          );
        },
      )
      .catch(() => undefined);
  }, [slug]);

  const cssVars = useMemo(() => storeStyleCssVars(style), [style]);

  function patch<K extends keyof StoreStyleSettings>(
    key: K,
    value: StoreStyleSettings[K],
  ) {
    setStyle((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    if (!slug) return;
    setSaving(true);
    setError("");
    try {
      const next = normalizeStoreStyle(style);
      const accent = storeStyleToAccent(next);
      const theme = storeStyleToTheme(next);
      const res = await fetch(
        `/api/stores/${encodeURIComponent(slug)}/content`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeStyle: next,
            theme,
            profile: {
              ...(content?.profile || {}),
              accent,
            },
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "儲存失敗");
      setStyle(next);
      setToastMsg("網站風格已套用至前台");
      setToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            網站風格工作室
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            自訂色票、字體、氛圍與圓角；儲存後立即反映在前台預約站。
          </p>
        </div>
        <Link href={slug ? `/stores/${slug}` : "/stores/nail-studio"}>
          <Button as="span" variant="outline">
            預覽前台
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>色票</CardTitle>
              <CardDescription>選擇品牌主色，或輸入自訂色碼</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  Object.keys(STORE_STYLE_PALETTE_LABELS) as StoreStylePalette[]
                ).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      patch("palette", p);
                      patch("customPrimary", null);
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                      style.palette === p && !style.customPrimary
                        ? "border-stone-900 ring-1 ring-stone-900"
                        : "border-stone-200 hover:border-stone-300",
                    )}
                  >
                    <span
                      className="mb-1.5 block h-6 w-full rounded-md"
                      style={{ background: paletteSwatch(p) }}
                    />
                    <span className="font-medium text-stone-800">
                      {STORE_STYLE_PALETTE_LABELS[p]}
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <Label htmlFor="sf-custom">自訂主色（選填 #RRGGBB）</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="sf-custom"
                    value={style.customPrimary || ""}
                    onChange={(e) =>
                      patch(
                        "customPrimary",
                        e.target.value.trim() ? e.target.value.trim() : null,
                      )
                    }
                    placeholder="#e11d48"
                    className="font-mono"
                  />
                  <input
                    type="color"
                    aria-label="選色"
                    value={style.customPrimary || paletteSwatch(style.palette)}
                    onChange={(e) => patch("customPrimary", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-stone-200 bg-white p-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>氛圍與字體</CardTitle>
              <CardDescription>決定頁面氣質與標題字體</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>氛圍</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(Object.keys(STORE_STYLE_MOOD_LABELS) as StoreStyleMood[]).map(
                    (m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => patch("mood", m)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm",
                          style.mood === m
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-200 text-stone-700",
                        )}
                      >
                        {STORE_STYLE_MOOD_LABELS[m]}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div>
                <Label>字體</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(Object.keys(STORE_STYLE_FONT_LABELS) as StoreStyleFont[]).map(
                    (f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => patch("font", f)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm",
                          style.font === f
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-200 text-stone-700",
                        )}
                      >
                        {STORE_STYLE_FONT_LABELS[f]}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div>
                <Label>圓角</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(
                    Object.keys(STORE_STYLE_RADIUS_LABELS) as StoreStyleRadius[]
                  ).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => patch("radius", r)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm",
                        style.radius === r
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 text-stone-700",
                      )}
                    >
                      {STORE_STYLE_RADIUS_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="sf-overlay">
                  Banner 遮罩濃度（{style.heroOverlay}%）
                </Label>
                <Input
                  id="sf-overlay"
                  type="range"
                  min={0}
                  max={80}
                  value={style.heroOverlay}
                  onChange={(e) =>
                    patch("heroOverlay", Number(e.target.value) || 0)
                  }
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {error ? (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            size="lg"
            disabled={saving || !slug}
            className="h-12 bg-teal-700 hover:bg-teal-800"
            onClick={() => void save()}
          >
            {saving ? "儲存中…" : "儲存並套用風格"}
          </Button>
        </div>

        <Card className="overflow-hidden lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle>即時預覽</CardTitle>
            <CardDescription>約略呈現前台色調與字體</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="overflow-hidden rounded-2xl border border-white/10 p-5 text-white shadow-xl"
              style={{
                ...cssVars,
                background: "var(--sf-page-bg)",
                fontFamily: "var(--sf-font)",
              }}
            >
              <p
                className="text-xs font-semibold tracking-wide"
                style={{ color: "var(--sf-accent-text)" }}
              >
                {content?.profile?.category || "美業預約"}
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight">
                {content?.profile?.name || "您的店家"}
              </h3>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--sf-accent-text)" }}
              >
                {content?.profile?.tagline || "自訂風格・線上極速預約"}
              </p>
              <div
                className="mt-4 overflow-hidden border border-white/10"
                style={{ borderRadius: "var(--sf-radius)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    content?.profile?.banner ||
                    "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80"
                  }
                  alt="banner preview"
                  className="h-28 w-full object-cover"
                  style={{
                    filter: `brightness(${1 - style.heroOverlay / 200})`,
                  }}
                />
              </div>
              <button
                type="button"
                className="mt-4 inline-flex h-11 items-center justify-center px-5 text-sm font-semibold"
                style={{
                  background: "var(--sf-primary)",
                  color: "var(--sf-button-text)",
                  borderRadius: "var(--sf-radius)",
                }}
              >
                立即預約
              </button>
              <div
                className="mt-4 border p-3 text-sm"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  background: "var(--sf-primary-soft)",
                  borderRadius: "var(--sf-radius)",
                }}
              >
                服務價目與預約按鈕會套用此風格色系。
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Toast open={toastOpen} onClose={closeToast} message={toastMsg} />
    </div>
  );
}

export function StoreStyleStudio() {
  const ready = useClientReady();
  if (!ready) {
    return (
      <div className="min-h-[240px] animate-pulse rounded-2xl bg-stone-100" />
    );
  }
  return <StyleStudioClient />;
}
