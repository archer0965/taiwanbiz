import { isDemoLoginEnabled, isGoogleAuthConfigured } from "@/auth";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "登入後台｜拓脈（Nova Crest Pulse）",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(79,70,229,0.35),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.25),transparent_30%)]" />
      <div className="relative w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <BrandLogo size={40} priority />
          <span>
            <span className="block text-sm font-bold text-slate-900">拓脈</span>
            <span className="block text-xs text-slate-400">
              Nova Crest Pulse · 店主／總管登入
            </span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          後台登入
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          總管理員可開通／暫停店家；自主方案店主使用綁定 Email
          登入後，僅能管理自己的店家資料。
        </p>
        <a
          href="https://paycheck.com.de/login?next=%2Fdashboard%2Fpass"
          className="mt-5 flex h-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
        >
          使用拓新雲端帳號（方案／訂閱）
        </a>
        <p className="mt-2 text-center text-xs text-slate-400">
          新客註冊與付費升級統一走主站；下方為既有店主／總管後台登入。
        </p>
        <div className="mt-7">
          <Suspense
            fallback={<div className="h-28 animate-pulse rounded-xl bg-slate-100" />}
          >
            <LoginForm
              googleEnabled={isGoogleAuthConfigured}
              demoEnabled={isDemoLoginEnabled}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
