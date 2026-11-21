import { WelcomeClient } from "@/components/billing/welcome-client";
import { Suspense } from "react";

export const metadata = {
  title: "開通完成｜拓脈（Nova Crest Pulse）",
  description: "訂閱付款完成後，前往您的獨立前台與店家後台。",
};

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen animate-pulse bg-slate-950" />
      }
    >
      <WelcomeClient />
    </Suspense>
  );
}
