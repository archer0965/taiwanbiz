"use client";

import { StoreSuspended } from "@/components/storefront/store-suspended";
import { getTenantBySlug } from "@/lib/tenant-storage";
import { useClientReady } from "@/lib/use-client-ready";
import { useEffect, useState } from "react";

type Props = {
  slug: string;
  storeName?: string;
  children: React.ReactNode;
};

export function StoreAccessGate({ slug, storeName, children }: Props) {
  const ready = useClientReady();
  const [suspended, setSuspended] = useState(false);
  const [name, setName] = useState(storeName);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      const local = getTenantBySlug(slug);
      if (local?.name) setName(local.name);

      try {
        const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/status`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as {
            suspended?: boolean;
            name?: string;
            status?: string;
          };
          if (!cancelled) {
            setSuspended(Boolean(data.suspended));
            if (data.name) setName(data.name);
            setChecked(true);
          }
          return;
        }
      } catch {
        // fallback local
      }

      if (!cancelled) {
        setSuspended(local?.status === "Suspended");
        setChecked(true);
      }
    }

    sync();
    window.addEventListener("taiwanbiz-storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("taiwanbiz-storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  if (!ready || !checked) {
    return <div className="min-h-screen animate-pulse bg-slate-950" />;
  }

  if (suspended) {
    return <StoreSuspended storeName={name} />;
  }

  return <>{children}</>;
}
