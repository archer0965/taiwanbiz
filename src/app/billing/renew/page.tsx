import { BillingRenewClient } from "@/components/billing/billing-renew-client";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "本月續約繳費｜拓脈",
  description: "取得 ATM／超商本月續約繳費碼並完成付款。",
};

export default function BillingRenewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
          載入續約頁…
        </div>
      }
    >
      <BillingRenewClient />
    </Suspense>
  );
}
