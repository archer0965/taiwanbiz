import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm font-semibold tracking-wide text-indigo-600">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">找不到此頁面</h1>
      <p className="mt-2 max-w-md text-slate-500">
        您造訪的連結不存在，或案例代號有誤。請返回首頁重新開始。
      </p>
      <Link href="/" className="mt-6">
        <Button as="span">回到首頁</Button>
      </Link>
    </div>
  );
}
