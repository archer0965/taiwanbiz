import { StorefrontRouter } from "@/components/storefront/storefront-router";
import {
  getStoreBySlug,
  listStoreSlugs,
  resolveStoreSlug,
  STORE_SLUG_ALIASES,
} from "@/data/stores-db";
import { getStoreProfile } from "@/lib/mock-data";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

/** 靜態預產租戶頁面（含舊 slug；select-shop 由專屬靜態路由承接） */
export function generateStaticParams() {
  const canonical = listStoreSlugs().filter((slug) => slug !== "select-shop");
  const aliases = Object.keys(STORE_SLUG_ALIASES);
  return [...canonical, ...aliases].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const store = getStoreBySlug(slug);
  if (!store) {
    return { title: "店家前台｜拓脈（Nova Crest Pulse）" };
  }
  return {
    title: `${store.name}｜拓脈（Nova Crest Pulse）`,
    description: store.description,
  };
}

/**
 * 動態多租戶路由：
 * - 靜態案例：SSR 帶入
 * - 新開通店：客戶端向 /api/stores/[slug]/content 取資料（避免 Blob SSR 競態 500）
 */
export default async function StorefrontRoute({ params }: Props) {
  const { slug } = await params;
  const resolved = resolveStoreSlug(slug);

  if (STORE_SLUG_ALIASES[slug]) {
    redirect(`/stores/${resolved}`);
  }

  if (resolved === "select-shop") {
    redirect("/stores/select-shop");
  }

  if (!resolved) notFound();

  const staticTenant = getStoreBySlug(resolved);
  const staticProfile = getStoreProfile(resolved);

  if (staticTenant && staticProfile) {
    return (
      <StorefrontRouter
        slug={resolved}
        initialTenant={staticTenant}
        initialProfile={staticProfile}
      />
    );
  }

  return <StorefrontRouter slug={resolved} />;
}
