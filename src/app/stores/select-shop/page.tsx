import { StorefrontRouter } from "@/components/storefront/storefront-router";
import { getStoreBySlug } from "@/data/stores-db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "脈線工作室｜拓脈預約案例",
  description:
    "實體服務業預約導流示範：線上預約、服務價目表、刮刮樂留客與 LINE 雙向通知。",
};

/**
 * 原網拍案例路由改為預約前台（電商購物車已下架）。
 */
export default function SelectShopPage() {
  const store = getStoreBySlug("select-shop");
  if (!store) notFound();
  return <StorefrontRouter slug="select-shop" initialTenant={store} />;
}
