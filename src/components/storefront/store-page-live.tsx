"use client";

import { DemoPresetSwitcher } from "@/components/storefront/demo-preset-switcher";
import {
  StorePage,
  type StoreDisplayOptions,
} from "@/components/storefront/store-page";
import type { StoreStaffMember } from "@/lib/beauty-ops";
import type { StoreProfile } from "@/lib/mock-data";
import {
  getStoreSettings,
  settingsToStoreProfile,
} from "@/lib/storage";
import {
  isDemoPreviewSlug,
  resolveStorefrontPreset,
  type StorefrontPreset,
} from "@/lib/storefront-preset";
import type { StoreStyleSettings } from "@/lib/store-style";
import { useClientReady } from "@/lib/use-client-ready";
import { useEffect, useState } from "react";

type Props = {
  store: StoreProfile;
  editable?: boolean;
  /** 伺服器／路由可先帶入的 preset（靜態示範） */
  initialPreset?: StorefrontPreset;
  /** URL ?preset=（server 解析） */
  forcedPreset?: StorefrontPreset | null;
};

function readLiveState(slug: string) {
  const settings = getStoreSettings();
  return {
    liveStore: settingsToStoreProfile(settings, slug),
    options: {
      announcement: settings.announcement,
      welcomeMessage: settings.welcomeMessage,
      showCampaign: settings.showCampaign,
      showContactForm: settings.showContactForm,
      showMapButton: settings.showMapButton,
      showLineButton: settings.showLineButton,
    } satisfies StoreDisplayOptions,
  };
}

function demoStaffForSlug(slug: string): StoreStaffMember[] {
  if (slug === "hair-salon") {
    return [
      {
        id: "st-owner",
        name: "設計師小安",
        isOwner: true,
        role: "stylist",
        active: true,
      },
      {
        id: "st-2",
        name: "設計師小雨",
        role: "stylist",
        active: true,
      },
    ];
  }
  if (slug === "nail-studio") {
    return [
      {
        id: "st-nail-a",
        name: "美甲師 A",
        isOwner: true,
        role: "stylist",
        active: true,
      },
      {
        id: "st-lash-b",
        name: "美睫師 B",
        role: "stylist",
        active: true,
      },
    ];
  }
  return [];
}

export function StorePageLive({
  store,
  editable = false,
  initialPreset,
  forcedPreset = null,
}: Props) {
  const ready = useClientReady();
  const isDemo = isDemoPreviewSlug(store.slug);
  const demoPreset =
    forcedPreset ||
    initialPreset ||
    resolveStorefrontPreset({ slug: store.slug });
  const [liveStore, setLiveStore] = useState(store);
  const [options, setOptions] = useState<StoreDisplayOptions>({});
  const [tenantPreset, setTenantPreset] = useState<StorefrontPreset>(demoPreset);
  const preset = isDemo ? demoPreset : tenantPreset;
  const [staff, setStaff] = useState<StoreStaffMember[]>(() =>
    demoStaffForSlug(store.slug),
  );
  const [bookingTerms, setBookingTerms] = useState<string | undefined>();
  const [storeStyle, setStoreStyle] = useState<StoreStyleSettings | null>(null);

  useEffect(() => {
    if (!editable || !ready) return;

    function sync() {
      const next = readLiveState(store.slug);
      setLiveStore(next.liveStore);
      setOptions(next.options);
    }

    sync();
    window.addEventListener("taiwanbiz-storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("taiwanbiz-storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, [editable, ready, store.slug]);

  useEffect(() => {
    let cancelled = false;

    async function loadPresetAndOps() {
      let planName: string | null = null;
      let listAmount: number | null = null;
      let contentPreset: StorefrontPreset | null = null;
      let nextStaff = demoStaffForSlug(store.slug);
      let terms: string | undefined;

      try {
        const statusRes = await fetch(
          `/api/tenants/${encodeURIComponent(store.slug)}/status`,
          { cache: "no-store" },
        );
        if (statusRes.ok) {
          const data = (await statusRes.json()) as {
            found?: boolean;
            planName?: string | null;
            listAmount?: number | null;
          };
          if (data.found) {
            planName = data.planName ?? null;
            listAmount =
              typeof data.listAmount === "number" ? data.listAmount : null;
          }
        }
      } catch {
        /* keep demo fallback */
      }

      try {
        const contentRes = await fetch(
          `/api/stores/${encodeURIComponent(store.slug)}/content`,
          { cache: "no-store" },
        );
        if (contentRes.ok) {
          const data = (await contentRes.json()) as {
            content?: {
              bookingTerms?: string;
              storefrontPreset?: StorefrontPreset;
              staff?: StoreStaffMember[];
              storeStyle?: StoreStyleSettings;
              theme?: StoreProfile["theme"];
              profile?: { accent?: StoreProfile["accent"] };
            };
          };
          if (data.content?.bookingTerms?.trim()) {
            terms = data.content.bookingTerms.trim();
          }
          if (
            data.content?.storefrontPreset === "basic" ||
            data.content?.storefrontPreset === "premium"
          ) {
            contentPreset = data.content.storefrontPreset;
          }
          const list = (data.content?.staff || []).filter(
            (s) => s.active !== false && s.name?.trim(),
          );
          if (list.length) nextStaff = list;
          if (data.content?.storeStyle) {
            if (!cancelled) setStoreStyle(data.content.storeStyle);
          }
          if (data.content?.theme || data.content?.profile?.accent) {
            if (!cancelled) {
              setLiveStore((prev) => ({
                ...prev,
                ...(data.content?.theme ? { theme: data.content.theme } : {}),
                ...(data.content?.profile?.accent
                  ? { accent: data.content.profile.accent }
                  : {}),
              }));
            }
          }
        }
      } catch {
        /* keep demo fallback */
      }

      if (cancelled) return;
      setStaff(nextStaff);
      setBookingTerms(terms);
      // 正式店才依內容／方案覆寫；示範站由 demoPreset（props）驅動
      if (!isDemo) {
        setTenantPreset(
          resolveStorefrontPreset({
            slug: store.slug,
            planName,
            listAmount,
            override: contentPreset || initialPreset || null,
          }),
        );
      }
    }

    void loadPresetAndOps();
    return () => {
      cancelled = true;
    };
  }, [store.slug, initialPreset, isDemo]);

  if (editable && !ready) {
    return <div className="min-h-screen animate-pulse bg-slate-950" />;
  }

  return (
    <>
      {isDemoPreviewSlug(store.slug) ? (
        <DemoPresetSwitcher slug={store.slug} preset={preset} />
      ) : null}
      <StorePage
        store={liveStore}
        options={editable ? options : undefined}
        preset={preset}
        staff={staff}
        bookingTerms={bookingTerms}
        showPlatformMarketing={isDemo}
        storeStyle={storeStyle}
      />
    </>
  );
}
