"use client";

import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import type { ShopProduct } from "@/data/stores-db";
import { ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  product: ShopProduct;
  onAdd: (payload: {
    product: ShopProduct;
    size: string;
    colorId: string;
    colorName: string;
  }) => void;
};

export function ShopProductCard({ product, onAdd }: Props) {
  const [size, setSize] = useState(product.sizes[0] ?? "");
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? "");
  const [hint, setHint] = useState("");

  const color = useMemo(
    () => product.colors.find((item) => item.id === colorId) ?? product.colors[0],
    [colorId, product.colors],
  );

  function handleAdd() {
    if (!size || !color) {
      setHint("請先選擇尺寸與顏色");
      return;
    }
    setHint("");
    onAdd({
      product,
      size,
      colorId: color.id,
      colorName: color.name,
    });
  }

  const isPreorder = product.stockStatus === "preorder";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-white/[0.05]">
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <SafeImage
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
          fallbackClassName="bg-slate-800 text-slate-400"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
        <span
          className={`absolute left-3 top-3 rounded-md border px-2.5 py-1 text-xs font-semibold backdrop-blur ${
            isPreorder
              ? "border-sky-300/30 bg-sky-400/15 text-sky-100"
              : "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
          }`}
        >
          {isPreorder ? "預購" : "現貨"}
        </span>
        <p className="absolute bottom-3 left-3 right-3 text-lg font-bold text-teal-200">
          NT$ {product.price.toLocaleString("zh-TW")}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-base font-semibold text-white sm:text-lg">
          {product.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {product.description}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-slate-400">
              尺寸
            </p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSize(option)}
                  className={`min-h-9 min-w-11 rounded-lg border px-3 text-sm font-medium transition ${
                    size === option
                      ? "border-teal-300/50 bg-teal-400/15 text-teal-100"
                      : "border-white/10 bg-black/20 text-slate-300 hover:border-white/25"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-slate-400">
              顏色
              {color ? (
                <span className="ml-2 text-slate-300">{color.name}</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.name}
                  title={option.name}
                  onClick={() => setColorId(option.id)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                    colorId === option.id
                      ? "border-teal-300 ring-2 ring-teal-300/40"
                      : "border-white/20 hover:border-white/40"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-full shadow-inner"
                    style={{ backgroundColor: option.swatch }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {hint ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {hint}
          </p>
        ) : null}

        <Button
          type="button"
          onClick={handleAdd}
          className="mt-5 h-11 w-full bg-teal-400 text-slate-950 hover:bg-teal-300"
        >
          <ShoppingBag className="h-4 w-4" />
          加入購物車
        </Button>
      </div>
    </article>
  );
}
