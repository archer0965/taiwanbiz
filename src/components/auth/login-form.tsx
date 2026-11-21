"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_OWNER_EMAILS, DEVELOPER_EMAILS } from "@/lib/roles";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
      <path
        fill="#34A853"
        d="M3.5 7.3l3.2 2.4C7.6 7.5 9.6 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2 12 2 8.1 2 4.8 4.2 3.5 7.3z"
      />
      <path
        fill="#4285F4"
        d="M12 22c2.5 0 4.7-.8 6.2-2.3l-2.9-2.5c-.8.6-1.9 1-3.3 1-3.1 0-5.7-2.1-6.6-4.9l-3.2 2.5C4 19.7 7.7 22 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 13.3c-.2-.6-.4-1.2-.4-1.9s.1-1.3.3-1.9L2.1 7C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5l3.3-3.7z"
      />
    </svg>
  );
}

type OwnerStep = "email" | "password" | "setup";

export function LoginForm({
  googleEnabled,
  demoEnabled,
}: {
  googleEnabled: boolean;
  demoEnabled: boolean;
}) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");
  const [loading, setLoading] = useState<"google" | "demo" | "owner" | null>(
    null,
  );
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<OwnerStep>("email");
  const [error, setError] = useState(
    errorParam === "AccessDenied"
      ? "此帳號無權限進入後台。僅總管理員或已綁定店主可登入。"
      : errorParam === "CredentialsSignin"
        ? "登入失敗：Email 或密碼不正確。"
        : "",
  );

  async function handleGoogle() {
    setError("");
    setLoading("google");
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Google 登入失敗，請稍後再試。");
      setLoading(null);
    }
  }

  async function handleDemoAdmin() {
    setError("");
    setLoading("demo");
    try {
      await signIn("demo", {
        email: DEVELOPER_EMAILS[0],
        callbackUrl: callbackUrl.startsWith("/admin")
          ? callbackUrl
          : "/admin/dashboard",
        redirect: true,
      });
    } catch {
      setError("總管理員登入失敗，請稍後再試。");
      setLoading(null);
    }
  }

  async function handleEmailContinue() {
    setError("");
    const email = ownerEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("請輸入訂閱時綁定的店主 Email");
      return;
    }
    setLoading("owner");
    try {
      const res = await fetch(
        `/api/auth/password-status?email=${encodeURIComponent(email)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        error?: string;
        allowed?: boolean;
        hasPassword?: boolean;
        needsSetup?: boolean;
        passwordRequired?: boolean;
        role?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "無法確認帳號");
      }
      if (!data.allowed) {
        setError(
          "此 Email 尚未綁定任何店家。請使用自主訂閱／試用時填寫的 Email。",
        );
        setLoading(null);
        return;
      }
      if (data.role === "admin" && !data.passwordRequired) {
        // 總管無強制密碼：直接走示範／內部登入
        const result = await signIn("demo", {
          email,
          callbackUrl: callbackUrl.startsWith("/admin")
            ? callbackUrl
            : "/admin/dashboard",
          redirect: false,
        });
        if (result?.error) {
          setError("總管登入失敗，請改用 Google 或本機總管按鈕。");
          setLoading(null);
          return;
        }
        window.location.href = result?.url || "/admin/dashboard";
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setStep(data.needsSetup || !data.hasPassword ? "setup" : "password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法確認帳號");
    } finally {
      setLoading(null);
    }
  }

  async function handleOwnerLogin() {
    setError("");
    const email = ownerEmail.trim().toLowerCase();
    if (!password) {
      setError("請輸入密碼");
      return;
    }
    setLoading("owner");
    try {
      const result = await signIn("demo", {
        email,
        password,
        callbackUrl: "/dashboard",
        redirect: false,
      });
      if (result?.error) {
        setError("登入失敗：Email 或密碼不正確。");
        setLoading(null);
        return;
      }
      window.location.href = result?.url || "/dashboard";
    } catch {
      setError("店主登入失敗，請確認密碼或稍後再試。");
      setLoading(null);
    }
  }

  async function handleOwnerSetup() {
    setError("");
    const email = ownerEmail.trim().toLowerCase();
    if (password !== confirmPassword) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    setLoading("owner");
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          confirmPassword,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "設定密碼失敗");
      }
      const result = await signIn("demo", {
        email,
        password,
        callbackUrl: "/dashboard",
        redirect: false,
      });
      if (result?.error) {
        setError("密碼已設定，但自動登入失敗，請重新輸入密碼登入。");
        setStep("password");
        setLoading(null);
        return;
      }
      window.location.href = result?.url || "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定密碼失敗");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {googleEnabled ? (
        <Button
          type="button"
          className="h-12 w-full text-base"
          onClick={handleGoogle}
          disabled={loading !== null}
        >
          <GoogleIcon />
          {loading === "google"
            ? "正在導向 Google…"
            : "使用 Google 登入（總管／已綁定店主）"}
        </Button>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <Label htmlFor="owner-email" className="text-slate-700">
          店主 Email（自主訂閱綁定信箱）
        </Label>
        <Input
          id="owner-email"
          type="email"
          value={ownerEmail}
          onChange={(e) => {
            setOwnerEmail(e.target.value);
            if (step !== "email") {
              setStep("email");
              setPassword("");
              setConfirmPassword("");
            }
          }}
          className="mt-1.5"
          placeholder="訂閱時填寫的 Email"
          autoComplete="email"
          disabled={loading !== null}
        />

        {step === "password" || step === "setup" ? (
          <div className="mt-3 space-y-3 animate-in fade-in duration-200">
            <div>
              <Label htmlFor="owner-password" className="text-slate-700">
                {step === "setup" ? "設定登入密碼" : "密碼"}
              </Label>
              <Input
                id="owner-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
                placeholder={
                  step === "setup" ? "至少 8 碼，含英文與數字" : "請輸入密碼"
                }
                autoComplete={
                  step === "setup" ? "new-password" : "current-password"
                }
                autoFocus
                disabled={loading !== null}
              />
            </div>
            {step === "setup" ? (
              <div>
                <Label htmlFor="owner-password2" className="text-slate-700">
                  再次確認密碼
                </Label>
                <Input
                  id="owner-password2"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5"
                  placeholder="再輸入一次密碼"
                  autoComplete="new-password"
                  disabled={loading !== null}
                />
                <p className="mt-1.5 text-xs text-amber-800">
                  此 Email 尚未綁定密碼。請設定專屬密碼，之後僅能以 Email＋密碼登入，避免他人冒用。
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                請輸入開通／訂閱時設定的登入密碼。
              </p>
            )}
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-slate-500">
            須與方案結帳時的「負責人 Email」相同。輸入後將請您輸入登入密碼。
          </p>
        )}

        {step === "email" ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-11 w-full"
            onClick={() => void handleEmailContinue()}
            disabled={loading !== null}
          >
            {loading === "owner" ? "確認中…" : "繼續"}
          </Button>
        ) : step === "setup" ? (
          <Button
            type="button"
            className="mt-3 h-11 w-full"
            onClick={() => void handleOwnerSetup()}
            disabled={loading !== null}
          >
            {loading === "owner" ? "設定並登入中…" : "設定密碼並登入後台"}
          </Button>
        ) : (
          <Button
            type="button"
            className="mt-3 h-11 w-full"
            onClick={() => void handleOwnerLogin()}
            disabled={loading !== null}
          >
            {loading === "owner" ? "登入中…" : "以店主身分登入後台"}
          </Button>
        )}

        {step !== "email" ? (
          <button
            type="button"
            className="mt-2 w-full text-center text-xs text-slate-500 underline-offset-2 hover:underline"
            onClick={() => {
              setStep("email");
              setPassword("");
              setConfirmPassword("");
              setError("");
            }}
            disabled={loading !== null}
          >
            使用其他 Email
          </button>
        ) : null}
      </div>

      {demoEnabled ? (
        <Button
          type="button"
          variant="primary"
          className="h-12 w-full text-base"
          onClick={handleDemoAdmin}
          disabled={loading !== null}
        >
          {loading === "demo" ? "登入中…" : "總管理員本機登入（開發用）"}
        </Button>
      ) : null}

      {demoEnabled ? (
        <p className="text-xs text-slate-400">
          示範店主：{DEMO_OWNER_EMAILS.join("、")}（首次登入需設定密碼）
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <p className="pt-2 text-center text-xs leading-relaxed text-slate-400">
        總管理後台僅限授權管理員；自主方案店主需 Email＋密碼登入，僅能管理自己的店家。
      </p>
    </div>
  );
}
