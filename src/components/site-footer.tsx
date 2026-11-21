import { BrandLogo } from "@/components/brand-logo";
import { DeveloperOnly } from "@/components/developer-only";
import { LineCtaLink } from "@/components/line-cta-link";
import {
  BUSINESS_EMAIL,
  LINE_FRIEND_URL,
  LINE_OFFICIAL_ID,
} from "@/lib/pricing";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div className="flex items-start gap-2.5 md:col-span-2 lg:col-span-1">
          <BrandLogo size={36} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              拓脈（Nova Crest Pulse）
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              專為美容美甲與美髮沙龍打造的極速預約官網。防撞期、離峰折扣與 LINE
              即時通知。
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            快速連結
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
            <Link href="/#demo" className="hover:text-indigo-600">
              互動 Demo
            </Link>
            <Link href="/#features" className="hover:text-indigo-600">
              功能亮點
            </Link>
            <Link href="/pricing" className="hover:text-indigo-600">
              方案價格
            </Link>
            <Link
              href="/stores/nail-studio?preset=basic#booking"
              className="hover:text-indigo-600"
            >
              美甲・基礎
            </Link>
            <Link
              href="/stores/nail-studio?preset=premium#booking"
              className="hover:text-indigo-600"
            >
              美甲・旗艦
            </Link>
            <Link
              href="/stores/hair-salon?preset=basic#booking"
              className="hover:text-indigo-600"
            >
              美髮・基礎
            </Link>
            <Link
              href="/stores/hair-salon?preset=premium#booking"
              className="hover:text-indigo-600"
            >
              美髮・旗艦
            </Link>
            <LineCtaLink className="hover:text-indigo-600">
              LINE 諮詢
            </LineCtaLink>
            <DeveloperOnly>
              <Link href="/dashboard" className="hover:text-indigo-600">
                店家後台
              </Link>
            </DeveloperOnly>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            法律與條款
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
            <Link href="/terms" className="hover:text-indigo-600">
              服務條款
            </Link>
            <Link href="/privacy" className="hover:text-indigo-600">
              隱私權政策
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            商務資訊
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>
              Email：{" "}
              <a
                href={`mailto:${BUSINESS_EMAIL}`}
                className="font-medium text-slate-800 hover:text-indigo-600"
              >
                {BUSINESS_EMAIL}
              </a>
            </p>
            <p>
              LINE：{" "}
              <LineCtaLink className="font-medium text-emerald-700 hover:text-emerald-600">
                {LINE_OFFICIAL_ID}
              </LineCtaLink>
            </p>
            <p className="text-xs break-all text-slate-400">{LINE_FRIEND_URL}</p>
            <p>服務範圍：台灣本島與離島遠端導入</p>
            <p className="text-xs text-slate-400">
              © 2026 拓脈（Nova Crest Pulse）. 保留所有權利。
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
