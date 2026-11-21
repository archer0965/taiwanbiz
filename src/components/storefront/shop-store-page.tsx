"use client";

import { DeveloperOnly } from "@/components/developer-only";
import { LineCtaLink } from "@/components/line-cta-link";
import { MembershipSection } from "@/components/storefront/membership-section";
import { ShopCartDrawer } from "@/components/storefront/shop-cart-drawer";
import { ShopCheckoutForm } from "@/components/storefront/shop-checkout-form";
import { ShopProductCard } from "@/components/storefront/shop-product-card";
import { StoreLegalFooter } from "@/components/storefront/store-legal-footer";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import type { ShopProduct, StoreTenant } from "@/data/stores-db";
import { formatTwd, LINE_FRIEND_URL } from "@/lib/pricing";
import { toSafeHttpUrl } from "@/lib/safe-url";
import {
  cartItemCount,
  cartSubtotal,
  clearCheckoutDraft,
  clearShopCart,
  loadShopCart,
  saveShopCart,
  updateCartQuantity,
  upsertCartLine,
  type ShopCartLine,
} from "@/lib/shop-cart";
import {
  formatShopPromoLabel,
  type ShopPromo,
} from "@/lib/shop-promos";
import {
  ArrowLeft,
  Clock3,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = {
  store: StoreTenant;
};

export function ShopStorePage({ store }: Props) {
  const products = store.shopProducts ?? [];
  const [lines, setLines] = useState<ShopCartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [returnBanner, setReturnBanner] = useState("");
  const [promoBanner, setPromoBanner] = useState("");

  useEffect(() => {
    setLines(loadShopCart(store.slug));
    setCartHydrated(true);
  }, [store.slug]);

  useEffect(() => {
    if (!cartHydrated) return;
    saveShopCart(store.slug, lines);
  }, [cartHydrated, lines, store.slug]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/stores/${encodeURIComponent(store.slug)}/content`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { content?: { shopPromos?: ShopPromo[] } }) => {
        if (cancelled) return;
        const active = (data.content?.shopPromos || []).filter(
          (p) => p.active && p.autoApply,
        );
        if (active.length === 0) {
          setPromoBanner("");
          return;
        }
        const labels = active
          .slice(0, 2)
          .map((p) => `${p.name}（${formatShopPromoLabel(p)}）`);
        setPromoBanner(
          `進行中優惠：${labels.join("、")}${
            active.length > 2 ? "…" : ""
          }・結帳自動套用`,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [store.slug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order") || "";
    if (params.get("paid") === "1") {
      setReturnBanner(
        orderId
          ? `付款完成，訂單 ${orderId} 已通知賣家備貨。`
          : "付款完成，賣家將盡快為您備貨出貨。",
      );
    } else if (params.get("cod") === "1") {
      setReturnBanner(
        orderId
          ? `貨到付款訂單 ${orderId} 已成立，取貨時再付款即可。`
          : "貨到付款訂單已成立，取貨時再付款即可。",
      );
    } else if (params.get("mock") === "1") {
      setReturnBanner(
        orderId
          ? `示範訂單 ${orderId} 已建立（未實際扣款）。`
          : "示範訂單已建立（未實際扣款）。",
      );
    }
  }, []);

  const lineUrl =
    toSafeHttpUrl(store.lineUrl) ||
    toSafeHttpUrl(LINE_FRIEND_URL) ||
    LINE_FRIEND_URL;
  const count = useMemo(() => cartItemCount(lines), [lines]);
  const total = useMemo(() => cartSubtotal(lines), [lines]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function handleAdd(payload: {
    product: ShopProduct;
    size: string;
    colorId: string;
    colorName: string;
  }) {
    setLines((prev) =>
      upsertCartLine(prev, {
        productId: payload.product.id,
        name: payload.product.name,
        price: payload.product.price,
        image: payload.product.image,
        size: payload.size,
        colorId: payload.colorId,
        colorName: payload.colorName,
        stockStatus: payload.product.stockStatus,
      }),
    );
    setCartOpen(true);
    showToast(`已加入：${payload.product.name}`);
  }

  function goCheckout() {
    setCartOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("checkout")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.16),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.15),rgba(2,6,23,0.96))]" />

      <div className="relative sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="touch-target inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">拓脈網拍案例</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LineCtaLink className="hidden sm:block">
              <Button
                as="span"
                size="sm"
                variant="ghost"
                className="text-slate-200 hover:bg-white/10 hover:text-white"
              >
                預約諮詢
              </Button>
            </LineCtaLink>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="touch-target relative inline-flex items-center gap-2 rounded-xl border border-teal-300/30 bg-teal-400/10 px-3 text-sm font-semibold text-teal-50 transition hover:bg-teal-400/20"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">購物車</span>
              <span className="rounded-md bg-teal-400 px-1.5 py-0.5 text-xs font-bold text-slate-950">
                {count}
              </span>
            </button>
            <DeveloperOnly>
              <Link href="/dashboard">
                <Button
                  as="span"
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                >
                  店家後台
                </Button>
              </Link>
            </DeveloperOnly>
          </div>
        </div>
      </div>

      <header className="relative">
        <div className="relative h-[42vh] min-h-[240px] w-full sm:h-[50vh]">
          <SafeImage
            src={store.banner}
            alt={store.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            fallbackClassName="bg-slate-900 text-slate-400"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/20" />
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8 sm:px-6 sm:pb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-100">
            <Sparkles className="h-3.5 w-3.5" />
            {store.category}
          </span>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
            {store.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
            {store.tagline}
          </p>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
            <Truck className="mb-2 h-4 w-4 text-teal-300" />
            超商取貨付款，適合 IG・Threads 個人賣家出貨節奏
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
            <ShoppingBag className="mb-2 h-4 w-4 text-teal-300" />
            尺寸・顏色選擇＋浮動購物車，一頁完成下單
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
            <Clock3 className="mb-2 h-4 w-4 text-teal-300" />
            {store.hours}
          </div>
        </section>

        {returnBanner ? (
          <p
            className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50"
            role="status"
          >
            {returnBanner}
          </p>
        ) : null}

        {store.announcement ? (
          <p className="rounded-2xl border border-teal-300/20 bg-teal-400/10 px-4 py-3 text-sm text-teal-50">
            {store.announcement}
          </p>
        ) : null}

        {promoBanner ? (
          <p className="flex items-start gap-2 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
            <Tag className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <span>{promoBanner}</span>
          </p>
        ) : null}

        <section>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            品牌選物
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {store.description}
          </p>
        </section>

        <section id="products" className="scroll-mt-24">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                商品列表
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                選擇尺寸與顏色後加入購物車，右側抽屜即時計算金額
              </p>
            </div>
            <a href={lineUrl} target="_blank" rel="noreferrer">
              <Button
                as="span"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10"
              >
                <MessageCircle className="h-4 w-4" />
                LINE 詢問現貨
              </Button>
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {products.map((product) => (
              <ShopProductCard
                key={product.id}
                product={product}
                onAdd={handleAdd}
              />
            ))}
          </div>
        </section>

        <MembershipSection
          storeSlug={store.slug}
          storeName={store.name}
          tone="shop"
        />

        <ShopCheckoutForm
          storeName={store.name}
          storeSlug={store.slug}
          lines={lines}
          onOrderPlaced={(info) => {
            setLines([]);
            clearShopCart(store.slug);
            clearCheckoutDraft(store.slug);
            showToast(
              info?.mode === "cod"
                ? "貨到付款訂單已成立"
                : info?.mode === "live"
                  ? "正在前往綠界付款"
                  : "訂單已送出",
            );
          }}
        />
      </main>

      <StoreLegalFooter storeName={store.name} />

      <ShopCartDrawer
        open={cartOpen}
        lines={lines}
        onClose={() => setCartOpen(false)}
        onChangeQty={(key, quantity) =>
          setLines((prev) => updateCartQuantity(prev, key, quantity))
        }
        onRemove={(key) =>
          setLines((prev) => prev.filter((line) => line.key !== key))
        }
        onCheckout={goCheckout}
      />

      {count > 0 ? (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-50 inline-flex max-w-[calc(100vw-2rem)] items-center gap-2 truncate rounded-2xl border border-teal-300/30 bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-2xl shadow-teal-500/30 transition hover:bg-teal-300 sm:right-6"
        >
          <ShoppingBag className="h-4 w-4" />
          {count} 件・{formatTwd(total)}
        </button>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-white/15 bg-slate-900/95 px-4 py-2 text-sm text-white shadow-xl sm:bottom-28">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
