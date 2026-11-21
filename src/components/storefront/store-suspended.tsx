import { BrandLogo } from "@/components/brand-logo";
import { LineCtaLink } from "@/components/line-cta-link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

type Props = {
  storeName?: string;
};

export function StoreSuspended({ storeName }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-12 text-stone-100">
      <div className="w-full max-w-lg rounded-3xl border border-rose-400/25 bg-stone-900 p-8 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-3">
          <BrandLogo size={40} />
          <div>
            <p className="text-sm font-bold text-white">拓脈 Nova Crest Pulse</p>
            <p className="text-xs text-stone-400">服務狀態通知</p>
          </div>
        </div>
        <div className="mt-6 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-rose-300" />
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              系統維護／方案已到期暫停預約
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">
              {storeName ? `「${storeName}」` : "此店家"}
              的訂閱方案已到期或暫停（subscriptions.status =
              expired）。線上預約暫時關閉；店家完成續費後即可恢復接單。
            </p>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/dashboard/billing">
            <Button as="span" className="bg-rose-500 text-white hover:bg-rose-400">
              快速續費
            </Button>
          </Link>
          <LineCtaLink>
            <Button
              as="span"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              LINE 聯繫續約
            </Button>
          </LineCtaLink>
          <Link href="/pricing">
            <Button
              as="span"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              查看方案
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
