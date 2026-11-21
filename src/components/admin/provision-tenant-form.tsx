"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEMO_TEMPLATES,
  type DemoTemplateId,
} from "@/lib/demo-templates";
import { provisionTenant } from "@/lib/tenant-storage";
import {
  PLAN_TYPE_LABELS,
  slugifyStoreName,
  type TenantPlanType,
  type TenantRecord,
} from "@/lib/tenants";
import { FormEvent, useState } from "react";

type Props = {
  onCreated: (slug: string, tenant?: TenantRecord) => void;
  onCancel: () => void;
};

const PLAN_OPTIONS: { id: TenantPlanType; hint: string }[] = [
  {
    id: "self-serve",
    hint: "極速預約基礎版／品牌導流旗艦版；綁定老闆 Email 登入後台",
  },
];

const TEMPLATE_STORAGE_KEY = "taiwanbiz-demo-templates";

function rememberTemplate(slug: string, templateId: DemoTemplateId) {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[slug] = templateId;
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readRememberedTemplate(slug: string): DemoTemplateId | null {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    const id = map[slug];
    if (id === "nail-lash" || id === "hair-salon") return id;
  } catch {
    /* ignore */
  }
  return null;
}

export function ProvisionTenantForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [planType, setPlanType] = useState<TenantPlanType>("self-serve");
  const [templateId, setTemplateId] = useState<DemoTemplateId>("nail-lash");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = provisionTenant({ name, slug, planType, ownerEmail });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    rememberTemplate(result.tenant.slug, templateId);
    const url = `${window.location.origin}/stores/${result.tenant.slug}`;
    setPreviewUrl(url);
    // 同步伺服器內容（含範本服務項目／刮刮樂）
    void fetch(`/api/stores/${encodeURIComponent(result.tenant.slug)}/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        demoTemplateId: templateId,
        seedDemo: true,
      }),
    }).catch(() => {});
    onCreated(result.tenant.slug, result.tenant);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="tenant-name" className="text-slate-300">
          店家名稱
        </Label>
        <Input
          id="tenant-name"
          value={name}
          onChange={(e) => {
            const value = e.target.value;
            setName(value);
            if (!slugTouched) setSlug(slugifyStoreName(value) || "new-store");
          }}
          placeholder="例如：澄光美甲工作室"
          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
        />
      </div>

      <div>
        <Label htmlFor="tenant-slug" className="text-slate-300">
          網址Slug
        </Label>
        <div className="mt-1.5 flex overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <span className="flex items-center px-3 text-xs text-slate-500">
            /stores/
          </span>
          <input
            id="tenant-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            }}
            className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="chenguang-nail"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-300">
          快速建立預約 Demo 範本
        </p>
        <div className="grid gap-2">
          {DEMO_TEMPLATES.map((tpl) => (
            <label
              key={tpl.id}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-sm transition ${
                templateId === tpl.id
                  ? "border-rose-300/40 bg-rose-400/10 text-rose-50"
                  : "border-white/10 bg-black/20 text-slate-300 hover:border-white/25"
              }`}
            >
              <input
                type="radio"
                name="demoTemplate"
                value={tpl.id}
                checked={templateId === tpl.id}
                onChange={() => setTemplateId(tpl.id)}
                className="sr-only"
              />
              <span className="font-semibold">{tpl.label}</span>
              <span className="mt-0.5 block text-xs opacity-80">
                {tpl.description}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-300">方案類型</p>
        <div className="grid gap-2">
          {PLAN_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-sm transition ${
                planType === option.id
                  ? "border-teal-300/40 bg-teal-400/10 text-teal-50"
                  : "border-white/10 bg-black/20 text-slate-300 hover:border-white/25"
              }`}
            >
              <input
                type="radio"
                name="planType"
                value={option.id}
                checked={planType === option.id}
                onChange={() => setPlanType(option.id)}
                className="sr-only"
              />
              <span className="font-semibold">
                {PLAN_TYPE_LABELS[option.id]}
              </span>
              <span className="mt-0.5 block text-xs opacity-80">{option.hint}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="tenant-owner" className="text-slate-300">
          老闆 Email
        </Label>
        <Input
          id="tenant-owner"
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="owner@example.com"
          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          開通後可直接複製前台連結私訊給店主預覽（14 天免費體驗）。
        </p>
      </div>

      {previewUrl ? (
        <div className="space-y-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
          <p>
            預覽連結：
            <a href={previewUrl} className="ml-1 break-all underline" target="_blank" rel="noreferrer">
              {previewUrl}
            </a>
          </p>
          <button
            type="button"
            className="rounded-lg border border-emerald-300/40 bg-black/20 px-2 py-1 font-semibold text-emerald-50 hover:bg-black/30"
            onClick={() => {
              void navigator.clipboard?.writeText(previewUrl);
            }}
          >
            複製連結（方便私訊給老闆）
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="submit"
          disabled={busy}
          className="h-11 bg-teal-400 text-slate-950 hover:bg-teal-300"
        >
          {busy ? "開通中…" : "一鍵套用範本並開通"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-11 border-white/15 bg-transparent text-slate-200 hover:bg-white/10"
        >
          取消
        </Button>
      </div>
    </form>
  );
}
