import Link from "next/link";

export default function QuotationNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-slate-100">
      <p className="text-lg font-semibold">找不到此店家的報價單</p>
      <p className="text-sm text-slate-400">
        請確認 store_id／slug 是否正確，或先於總管理後台開通店家。
      </p>
      <Link
        href="/admin/dashboard"
        className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-300"
      >
        返回總管理後台
      </Link>
    </div>
  );
}
