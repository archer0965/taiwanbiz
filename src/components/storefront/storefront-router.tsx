"use client";

import { StoreAccessGate } from "@/components/storefront/store-access-gate";
import { StorePageLive } from "@/components/storefront/store-page-live";
import { getStoreBySlug, type StoreTenant } from "@/data/stores-db";
import type { StoreProfile } from "@/lib/mock-data";
import {
  parseStorefrontPreset,
  type StorefrontPreset,
} from "@/lib/storefront-preset";
import { useClientReady } from "@/lib/use-client-ready";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Props = {
  slug: string;
  /** 靜態 DB 命中時由 server 帶入，加速首屏 */
  initialTenant?: StoreTenant | null;
  initialProfile?: StoreProfile | null;
};

function tenantToProfile(tenant: StoreTenant): StoreProfile {
  return {
    slug: tenant.slug,
    name: tenant.name,
    category: tenant.category,
    tagline: tenant.tagline,
    description: tenant.description,
    phone: tenant.phone,
    hours: tenant.hours,
    address: tenant.address,
    mapUrl: tenant.mapUrl,
    lineUrl: tenant.lineUrl,
    banner: tenant.banner,
    accent:
      tenant.theme === "nail"
        ? "rose"
        : tenant.theme === "shop"
          ? "amber"
          : "emerald",
    theme: tenant.theme,
    announcement: tenant.announcement,
    welcomeMessage: tenant.welcomeMessage,
    showCampaign: tenant.showCampaign,
    showContactForm: tenant.showContactForm,
    products: tenant.products,
    campaign: tenant.campaign,
  };
}

function defaultDemoPreset(slug: string): StorefrontPreset | undefined {
  if (slug === "nail-studio") return "basic";
  if (slug === "hair-salon") return "premium";
  return undefined;
}

function StorePageLiveWithQuery({
  store,
  editable,
}: {
  store: StoreProfile;
  editable: boolean;
}) {
  const searchParams = useSearchParams();
  const forcedPreset = parseStorefrontPreset(searchParams.get("preset"));
  const initialPreset = forcedPreset || defaultDemoPreset(store.slug);
  return (
    <StorePageLive
      store={store}
      editable={editable}
      forcedPreset={forcedPreset}
      initialPreset={initialPreset}
    />
  );
}

export function StorefrontRouter({
  slug,
  initialTenant = null,
  initialProfile = null,
}: Props) {
  const ready = useClientReady();
  const [tenant, setTenant] = useState<StoreTenant | null>(initialTenant);
  const [profile, setProfile] = useState<StoreProfile | null>(initialProfile);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(!initialTenant);

  useEffect(() => {
    let cancelled = false;
    async function resolve(attempt = 0) {
      const staticTenant = getStoreBySlug(slug);
      if (staticTenant) {
        if (cancelled) return;
        setTenant(staticTenant);
        setProfile(tenantToProfile(staticTenant));
        setMissing(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/stores/${encodeURIComponent(slug)}/content`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (attempt < 3) {
            window.setTimeout(() => void resolve(attempt + 1), 400 * (attempt + 1));
            return;
          }
          if (!initialTenant && !cancelled) {
            setMissing(true);
            setTenant(null);
            setProfile(null);
          }
          if (!cancelled) setLoading(false);
          return;
        }
        const data = (await res.json()) as {
          store?: StoreTenant;
        };
        if (cancelled) return;
        if (!data.store) {
          if (attempt < 3) {
            window.setTimeout(() => void resolve(attempt + 1), 400 * (attempt + 1));
            return;
          }
          if (!initialTenant) setMissing(true);
          setLoading(false);
          return;
        }
        setTenant(data.store);
        setProfile(tenantToProfile(data.store));
        setMissing(false);
      } catch {
        if (attempt < 3) {
          window.setTimeout(() => void resolve(attempt + 1), 400 * (attempt + 1));
          return;
        }
        if (!initialTenant && !cancelled) setMissing(true);
      } finally {
        if (!cancelled && (staticTenant || attempt >= 3 || initialTenant)) {
          setLoading(false);
        }
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [slug, initialTenant]);

  if ((loading || !ready) && !tenant) {
    return <div className="min-h-screen animate-pulse bg-slate-950" />;
  }

  if (missing || !tenant || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-300">
        <div>
          <p className="text-lg font-semibold text-white">找不到此店家</p>
          <p className="mt-2 text-sm text-slate-400">
            請確認 slug，或至總管理後台一鍵開通。
          </p>
        </div>
      </div>
    );
  }

  const editable = slug === "brunch-house";
  const fallback = (
    <StorePageLive
      store={profile}
      editable={editable}
      initialPreset={defaultDemoPreset(slug)}
    />
  );

  // Suspense fallback 直接渲染完整前台（非空白 pulse），再由 query 覆寫 preset
  const content = (
    <Suspense fallback={fallback}>
      <StorePageLiveWithQuery store={profile} editable={editable} />
    </Suspense>
  );

  return (
    <StoreAccessGate slug={slug} storeName={tenant.name}>
      {content}
    </StoreAccessGate>
  );
}
