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
import {
  DEMO_TEMPLATES,
  type DemoTemplateId,
} from "@/lib/demo-templates";
import { useActiveStore } from "@/lib/use-active-store";
import { Check, Copy, Sparkles } from "lucide-react";
import { useState } from "react";

/** 店家後台：一鍵套用美業／沙龍 Demo 範本並產生預覽連結 */
export function DemoBuilderCard() {
  const { slug } = useActiveStore();
  const [templateId, setTemplateId] = useState<DemoTemplateId>("nail-lash");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function applyTemplate() {
    if (!slug) {
      setError("請先綁定店家");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/stores/${encodeURIComponent(slug)}/content`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seedDemo: true,
            demoTemplateId: templateId,
            ...(displayName.trim()
              ? { profile: { name: displayName.trim() } }
              : {}),
          }),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        previewPath?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "套用失敗");

      // 若有改店名，再補一次 profile 名稱
      if (displayName.trim()) {
        await fetch(`/api/stores/${encodeURIComponent(slug)}/content`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: { name: displayName.trim() } }),
        });
      }

      const url = `${window.location.origin}${data.previewPath || `/stores/${slug}`}`;
      setPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "套用失敗");
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("無法複製連結");
    }
  }

  return (
    <Card className="border-stone-200 bg-gradient-to-b from-stone-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-stone-900">
          <Sparkles className="h-5 w-5 text-amber-700" />
          快速建立預約 Demo 範本
        </CardTitle>
        <CardDescription>
          一鍵套用美甲美睫或髮型沙龍預設項目／人員／刮刮樂，產生可私訊分享的預覽連結。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="demo-store-name">店名（選填，覆蓋前台顯示）</Label>
          <Input
            id="demo-store-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例如：澄光美甲工作室"
            className="mt-1.5 border-stone-200"
          />
        </div>
        <div className="grid gap-2">
          {DEMO_TEMPLATES.map((tpl) => (
            <label
              key={tpl.id}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-sm transition ${
                templateId === tpl.id
                  ? "border-stone-800 bg-stone-900 text-stone-50"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
              }`}
            >
              <input
                type="radio"
                name="dashDemoTemplate"
                className="sr-only"
                checked={templateId === tpl.id}
                onChange={() => setTemplateId(tpl.id)}
              />
              <span className="font-semibold">{tpl.label}</span>
              <span
                className={`mt-0.5 block text-xs ${
                  templateId === tpl.id ? "text-stone-300" : "text-stone-500"
                }`}
              >
                {tpl.description}
              </span>
            </label>
          ))}
        </div>
        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        {previewUrl ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            預覽連結：
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-1 break-all underline"
            >
              {previewUrl}
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void copyUrl()}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "已複製" : "複製連結"}
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          disabled={busy || !slug}
          className="h-11 w-full bg-stone-900 text-stone-50 hover:bg-stone-800 sm:w-auto"
          onClick={() => void applyTemplate()}
        >
          {busy ? "套用中…" : "一鍵套用範本並產生預覽"}
        </Button>
      </CardContent>
    </Card>
  );
}
