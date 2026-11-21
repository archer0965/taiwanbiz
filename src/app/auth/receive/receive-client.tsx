"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { parseHandoffHash, sanitizeNextPath } from "@/lib/auth-receive";
import { hubAuthRedirect } from "@/lib/hub-auth";

export function AuthReceiveClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("正在完成登入…");

  useEffect(() => {
    const next = sanitizeNextPath(searchParams.get("next"), "/welcome");
    let cancelled = false;

    (async () => {
      const tokens = parseHandoffHash(window.location.hash || "");
      if (tokens) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
        const result = await signIn("hub", {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          redirect: false,
          callbackUrl: next,
        });
        if (cancelled) return;
        if (result?.ok) {
          router.replace(next);
          router.refresh();
          return;
        }
        setMessage(result?.error || "登入橋接失敗，請重新嘗試");
        return;
      }

      setMessage("登入狀態未帶入，改導向拓新雲端…");
      window.location.replace(hubAuthRedirect("login", next));
    })().catch(() => {
      if (!cancelled) setMessage("登入失敗，請重新嘗試");
    });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-300">
      <p className="text-sm">{message}</p>
    </main>
  );
}
