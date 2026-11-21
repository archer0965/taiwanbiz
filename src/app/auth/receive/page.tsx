import { Suspense } from "react";
import { AuthReceiveClient } from "./receive-client";

export const metadata = { title: "完成登入｜拓脈" };

export default function AuthReceivePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-300">
          <p className="text-sm">正在完成登入…</p>
        </main>
      }
    >
      <AuthReceiveClient />
    </Suspense>
  );
}
