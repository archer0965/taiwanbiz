"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function TrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastKey = useRef("");

  useEffect(() => {
    if (!pathname) return;
    // 後台／總管頁不計入官網瀏覽（避免自己操作灌水）
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/api")
    ) {
      return;
    }

    const key = `${pathname}?${searchParams?.toString() || ""}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const payload = JSON.stringify({ path: pathname });
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/analytics/view", blob);
        return;
      }
    } catch {
      // fall through to fetch
    }

    void fetch("/api/analytics/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}

/** 全站頁面瀏覽追蹤（官網／案例／登入等公開頁） */
export function SiteViewTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInner />
    </Suspense>
  );
}
