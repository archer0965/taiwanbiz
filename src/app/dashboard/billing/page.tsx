import { BillingPanel } from "@/components/dashboard/billing-panel";

export const metadata = {
  title: "訂閱與付款｜拓脈（Nova Crest Pulse）",
  description: "管理訂閱帳單，並取消信用卡定期定額或 ATM／超商續約。",
};

export default function DashboardBillingPage() {
  return <BillingPanel />;
}
