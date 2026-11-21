import type { Metadata } from "next";
import Link from "next/link";
import { LINE_FRIEND_URL } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "退款說明｜拓脈",
  description: "拓脈訂閱退款與權益說明（對齊拓新雲端主站）。",
};

export default function RefundPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold text-white">退款說明</h1>
      <p className="mt-4 text-sm leading-7 text-slate-300">
        拓脈付費方案之價格、折扣、退款與取消規則，以拓新雲端主站（paycheck.com.de）為權威。
        付款成功後權益由後端回調更新。
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-400">
        <li>取消／退款請先至主站訂閱中控或透過官方 LINE 客服協助。</li>
        <li>早鳥試用 7 天、特約 14 天；額度與方案顯示衝突時以主站為準。</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <a
          href="https://paycheck.com.de/refund"
          className="font-semibold text-cyan-300 underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          主站退款說明
        </a>
        <a
          href={LINE_FRIEND_URL}
          className="font-semibold text-emerald-300 underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          LINE 客服 @469uykad
        </a>
        <Link href="/terms" className="text-slate-300 hover:underline">
          服務條款
        </Link>
        <Link href="/privacy" className="text-slate-300 hover:underline">
          隱私政策
        </Link>
      </div>
    </main>
  );
}
