import { redirect } from "next/navigation";

export const metadata = {
  title: "優惠活動｜拓脈（Nova Crest Pulse）",
  description: "網拍優惠與金物流活動已下架；請改用刮刮樂活動。",
};

/** 網拍優惠／金物流 UI 已下架 */
export default function ShopPromosPage() {
  redirect("/dashboard/campaigns/new");
}
