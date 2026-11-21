"use client";

import type { StoreContentRecord } from "@/lib/store-content";
import type { TenantRecord } from "@/lib/tenants";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export function useActiveStore() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [contents, setContents] = useState<StoreContentRecord[]>([]);
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetch("/api/stores/mine", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.tenants || []) as TenantRecord[];
        const storeContents = (data.contents || []) as StoreContentRecord[];
        setTenants(list);
        setContents(storeContents);
        const preferred =
          list[0]?.slug || storeContents[0]?.slug || "";
        setSlug(preferred);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const content = contents.find((c) => c.slug === slug) || contents[0] || null;
  const tenant = tenants.find((t) => t.slug === slug) || tenants[0] || null;

  return { email, tenants, contents, slug, setSlug, content, tenant, loading };
}
