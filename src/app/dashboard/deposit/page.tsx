import { DepositSettingsPanel } from "@/components/dashboard/deposit-settings-panel";

export default function DashboardDepositPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          訂金與金流開關
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          設定顧客預約是否需訂金，以及現場付／匯款／綠界線上支付。
        </p>
      </div>
      <DepositSettingsPanel />
    </div>
  );
}
