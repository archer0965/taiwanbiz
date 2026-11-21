import { BUSINESS_EMAIL, LINE_OFFICIAL_ID } from "@/lib/pricing";
import { Shield } from "lucide-react";
import Link from "next/link";

type Props = {
  storeName: string;
};

/**
 * 店家獨立前台「硬性」法律與權益區塊。
 * 不可由後台開關關閉，用以保全拓脈平台權益與個資法告知義務。
 */
export function StoreLegalFooter({ storeName }: Props) {
  return (
    <footer
      id="store-legal"
      className="relative border-t border-white/10 bg-slate-950 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-10 text-slate-300"
    >
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 sm:p-5">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div className="min-w-0 space-y-2 text-sm leading-relaxed">
            <p className="font-semibold text-amber-100">必要條款（不可關閉）</p>
            <p>
              本頁「{storeName}」由拓脈（Nova Crest
              Pulse）平台提供系統建置。店家提供之圖文、商標與價格資訊，權利歸店家或合法權利人所有；平台系統架構、程式碼、介面與互動行銷模組之智慧財產權歸
              Nova Crest Pulse 所有，未經授權不得重製、改作或移作他用。
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 text-sm leading-relaxed">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              個人資料與行銷名單
            </p>
            <p>
              透過刮刮樂、優惠券或聯絡表單所蒐集之手機號碼等個人資料，由「{storeName}
              」作為蒐集／保有者，僅得於告知之目的範圍內使用，並應遵守台灣《個人資料保護法》。拓脈僅於提供系統服務之必要範圍內受託處理，不會擅自出售或無權對外洩漏該等名單。
            </p>
          </div>
          <div className="space-y-2 text-sm leading-relaxed">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              平台標示與服務關係
            </p>
            <p>
              本站底部必須保留「Powered by 拓脈」標示與本條款連結。訂閱、線上預約與刮刮樂留客等，以拓脈《服務條款》及個別訂單為準。本平台不提供周邊商品購物車或超商金物流。商務聯繫：
              {BUSINESS_EMAIL}／LINE {LINE_OFFICIAL_ID}。
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            © 2026 {storeName}　｜　技術與平台{" "}
            <Link href="/" className="font-medium text-emerald-300 hover:text-emerald-200">
              Powered by 拓脈（Nova Crest Pulse）
            </Link>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
            <Link href="/terms" className="text-slate-300 hover:text-white">
              服務條款
            </Link>
            <Link href="/privacy" className="text-slate-300 hover:text-white">
              隱私權政策
            </Link>
            <Link href="/#contact" className="text-slate-300 hover:text-white">
              我也要開店家官網
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
