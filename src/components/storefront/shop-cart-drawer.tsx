"use client";

import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import {
  cartItemCount,
  cartSubtotal,
  type ShopCartLine,
} from "@/lib/shop-cart";
import { formatTwd } from "@/lib/pricing";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";

type Props = {
  open: boolean;
  lines: ShopCartLine[];
  onClose: () => void;
  onChangeQty: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
};

export function ShopCartDrawer({
  open,
  lines,
  onClose,
  onChangeQty,
  onRemove,
  onCheckout,
}: Props) {
  const count = cartItemCount(lines);
  const total = cartSubtotal(lines);

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm transition ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-white/10 bg-slate-950 pt-[env(safe-area-inset-top,0px)] shadow-2xl shadow-black/50 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
        aria-label="購物車"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-teal-300" />
            <h2 className="text-base font-semibold text-white">購物車</h2>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-slate-300">
              {count} 件
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="關閉購物車"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scroll-y-touch flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {lines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-200">購物車還是空的</p>
              <p className="mt-1 text-sm text-slate-500">
                選好尺寸與顏色後，點「加入購物車」即可開始結帳。
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl">
                    <SafeImage
                      src={line.image}
                      alt={line.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                      fallbackClassName="bg-slate-800 text-[10px] text-slate-400"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {line.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {line.size} ／ {line.colorName}
                          {line.stockStatus === "preorder" ? " ／ 預購" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(line.key)}
                        className="touch-target inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-rose-300"
                        aria-label={`移除 ${line.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-lg border border-white/10 bg-black/30">
                        <button
                          type="button"
                          className="p-2 text-slate-300 hover:text-white"
                          onClick={() =>
                            onChangeQty(line.key, line.quantity - 1)
                          }
                          aria-label="減少數量"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm text-white">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          className="p-2 text-slate-300 hover:text-white"
                          onClick={() =>
                            onChangeQty(line.key, line.quantity + 1)
                          }
                          aria-label="增加數量"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-teal-200">
                        {formatTwd(line.price * line.quantity)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">小計</span>
            <span className="text-lg font-bold text-white">{formatTwd(total)}</span>
          </div>
          <Button
            type="button"
            disabled={lines.length === 0}
            onClick={onCheckout}
            className="h-12 w-full bg-teal-400 text-base text-slate-950 hover:bg-teal-300 disabled:opacity-40"
          >
            前往一頁式結帳
          </Button>
          <p className="mt-2 text-center text-xs text-slate-500">
            金額即時計算；結帳將導向綠界 ECPay 付款。
          </p>
        </div>
      </aside>
    </>
  );
}
