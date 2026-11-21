import { CampaignBuilder } from "@/components/dashboard/campaign-builder";

export const metadata = {
  title: "建立行銷活動｜拓脈（Nova Crest Pulse）",
  description: "自訂優惠券與刮刮樂活動，即時預覽並生成專屬連結。",
};

export default function NewCampaignPage() {
  return <CampaignBuilder />;
}
