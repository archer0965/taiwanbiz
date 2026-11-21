import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "總管理後台｜拓脈（Nova Crest Pulse）",
  description: "Super Admin：店家開通、方案狀態與一鍵暫停／恢復。",
};

export default function AdminDashboardPage() {
  return <AdminDashboard />;
}
