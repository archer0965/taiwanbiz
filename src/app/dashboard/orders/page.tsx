import { redirect } from "next/navigation";

export const metadata = {
  title: "訂單管理｜拓脈（Nova Crest Pulse）",
  description: "網拍訂單與超商物流已下架；請改用預約後台。",
};

/** 網拍訂單／綠界物流 UI 已下架 */
export default function DashboardOrdersPage() {
  redirect("/dashboard");
}
