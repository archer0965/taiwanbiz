"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirectToEcpay } from "@/lib/checkout-client";
import { shopPaymentsUnavailableMessage } from "@/lib/ecpay-payments";
import {
  PAYMENT_METHODS,
  PICKUP_METHODS,
  cartSubtotal,
  loadCheckoutDraft,
  paymentMethodsForPickup,
  saveCheckoutDraft,
  saveShopCart,
  type PaymentMethodId,
  type PickupMethodId,
  type ShopCartLine,
} from "@/lib/shop-cart";
import {
  formatTaiwanMobileDisplay,
  isValidTaiwanMobile,
  normalizeTaiwanMobile,
} from "@/lib/phone";
import { formatTwd } from "@/lib/pricing";
import { applyShopPromo, type ShopPromo } from "@/lib/shop-promos";
import {
  emptyShipping,
  resolveOrderShippingFee,
  type StoreShippingSettings,
} from "@/lib/store-content";
import { CheckCircle2, CreditCard, MapPinned, Package, Tag } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  storeName: string;
  storeSlug: string;
  lines: ShopCartLine[];
  onOrderPlaced: (info?: { mode?: string }) => void;
};

export function ShopCheckoutForm({
  storeName,
  storeSlug,
  lines,
  onOrderPlaced,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickup, setPickup] = useState<PickupMethodId>("711");
  const [storeCode, setStoreCode] = useState("");
  const [storeNameCvs, setStoreNameCvs] = useState("");
  const [storeAddrCvs, setStoreAddrCvs] = useState("");
  const [manualStore, setManualStore] = useState(false);
  const [payment, setPayment] = useState<PaymentMethodId>("cod");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [emapHint, setEmapHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [emapBusy, setEmapBusy] = useState(false);
  const [shippingSettings, setShippingSettings] =
    useState<StoreShippingSettings>(() => emptyShipping());
  const [promos, setPromos] = useState<ShopPromo[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoHint, setPromoHint] = useState("");
  const [orderSummary, setOrderSummary] = useState<{
    id: string;
    total: number;
    shippingFee?: number;
    discountAmount?: number;
    promoName?: string;
    name: string;
    phone: string;
    pickup: PickupMethodId;
    payment: PaymentMethodId;
    paymentCode?: string;
    mode?: string;
    message?: string;
  } | null>(null);

  const subtotal = cartSubtotal(lines);
  const previewPromo = useMemo(
    () => applyShopPromo(promos, subtotal, promoCode),
    [promos, subtotal, promoCode],
  );
  const discountAmount = previewPromo?.discountAmount || 0;
  const { shippingFee: baseShippingFee, shippingPayer } =
    resolveOrderShippingFee(pickup, shippingSettings);
  const shippingFee = previewPromo?.freeShipping ? 0 : baseShippingFee;
  const total = Math.max(0, subtotal - discountAmount) + shippingFee;
  const needsStore = pickup === "711" || pickup === "family";
  const availablePayments = paymentMethodsForPickup(pickup);
  const draftReady = useRef(false);
  const pickupRef = useRef(pickup);

  useEffect(() => {
    const draft = loadCheckoutDraft(storeSlug);
    if (draft.name) setName(draft.name);
    if (draft.phone) setPhone(draft.phone);
    if (draft.pickup === "711" || draft.pickup === "family") {
      setPickup(draft.pickup);
      pickupRef.current = draft.pickup;
    }
    if (draft.note) setNote(draft.note);
    if (draft.promoCode) setPromoCode(draft.promoCode);
    if (draft.storeCode) setStoreCode(draft.storeCode);
    if (draft.storeNameCvs) setStoreNameCvs(draft.storeNameCvs);
    if (draft.storeAddrCvs) setStoreAddrCvs(draft.storeAddrCvs);
    draftReady.current = true;
  }, [storeSlug]);

  useEffect(() => {
    if (!draftReady.current || orderSummary) return;
    saveCheckoutDraft(storeSlug, {
      name,
      phone,
      pickup,
      note,
      promoCode,
      storeCode,
      storeNameCvs,
      storeAddrCvs,
    });
  }, [
    storeSlug,
    name,
    phone,
    pickup,
    note,
    promoCode,
    storeCode,
    storeNameCvs,
    storeAddrCvs,
    orderSummary,
  ]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/stores/${encodeURIComponent(storeSlug)}/content`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then(
        (data: {
          content?: {
            shipping?: StoreShippingSettings;
            shopPromos?: ShopPromo[];
          };
        }) => {
          if (cancelled || !data.content) return;
          if (data.content.shipping) {
            setShippingSettings({
              ...emptyShipping(),
              ...data.content.shipping,
            });
          }
          if (Array.isArray(data.content.shopPromos)) {
            setPromos(data.content.shopPromos);
          }
        },
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  useEffect(() => {
    if (!promoCode.trim()) {
      if (previewPromo?.promoName) {
        setPromoHint(
          `已自動套用：${previewPromo.promoName}${
            discountAmount > 0 ? `（折抵 ${formatTwd(discountAmount)}）` : ""
          }${previewPromo.freeShipping ? "・免運" : ""}`,
        );
      } else {
        setPromoHint("");
      }
      return;
    }
    if (previewPromo) {
      setPromoHint(
        `已套用 ${previewPromo.promoName || previewPromo.promoCode}${
          discountAmount > 0 ? `・折抵 ${formatTwd(discountAmount)}` : ""
        }${previewPromo.freeShipping ? "・免運" : ""}`,
      );
    } else {
      setPromoHint("優惠碼無效或未達門檻");
    }
  }, [promoCode, previewPromo, discountAmount]);

  function applyCvsStore(input: {
    storeId?: string;
    storeName?: string;
    storeAddr?: string;
    hint?: string;
  }) {
    if (input.storeId) setStoreCode(input.storeId);
    if (input.storeName) setStoreNameCvs(input.storeName);
    if (input.storeAddr) setStoreAddrCvs(input.storeAddr);
    if (input.storeId || input.storeName) {
      setManualStore(false);
      setEmapHint(input.hint || "已選取門市，請繼續完成結帳。");
    }
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as {
        type?: string;
        storeId?: string;
        storeName?: string;
        storeAddr?: string;
      };
      if (data?.type !== "ecpay-emap") return;
      applyCvsStore({
        storeId: data.storeId,
        storeName: data.storeName,
        storeAddr: data.storeAddr,
        hint: "已選取門市，請繼續完成結帳。",
      });
      // 帶回門市後捲到結帳區
      document.getElementById("checkout")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("emap") === "1") {
      applyCvsStore({
        storeId: params.get("storeId") || "",
        storeName: params.get("storeName") || "",
        storeAddr: params.get("storeAddr") || "",
        hint: "已從電子地圖帶回門市資料。",
      });
      // 清掉 query，避免重新整理又觸發；保留 hash 結帳錨點
      const clean = `${window.location.pathname}#checkout`;
      window.history.replaceState({}, "", clean);
      requestAnimationFrame(() => {
        document.getElementById("checkout")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  useEffect(() => {
    // 僅在使用者切換取貨方式時清門市；掛載時不可清，否則 emap 回傳會被洗掉
    if (pickupRef.current === pickup) return;
    pickupRef.current = pickup;
    setStoreCode("");
    setStoreNameCvs("");
    setStoreAddrCvs("");
    setEmapHint("");
  }, [pickup]);

  useEffect(() => {
    setPayment("cod");
  }, [pickup]);

  function openEmapForm(
    action: string,
    params: Record<string, string>,
    usePopup: boolean,
  ) {
    // iOS／行動裝置：綠界文件建議勿另開視窗
    if (!usePopup) {
      redirectToEcpay(action, params);
      return;
    }
    const winName = "ecpay-emap";
    const w = window.open("about:blank", winName, "width=1024,height=720");
    const form = document.createElement("form");
    form.method = "POST";
    form.action = action;
    form.acceptCharset = "UTF-8";
    form.target = w ? winName : "_self";
    form.style.display = "none";
    for (const [key, value] of Object.entries(params)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  async function openEmap() {
    setEmapBusy(true);
    setError("");
    setEmapHint("");
    // 整頁跳轉前先落盤，避免回來購物車／表單空白
    saveShopCart(storeSlug, lines);
    saveCheckoutDraft(storeSlug, {
      name,
      phone,
      pickup,
      note,
      promoCode,
      storeCode,
      storeNameCvs,
      storeAddrCvs,
    });
    try {
      const isMobile =
        typeof window !== "undefined" &&
        (window.matchMedia("(max-width: 768px)").matches ||
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

      const res = await fetch("/api/logistics/emap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          pickup: pickup === "family" ? "family" : "711",
          device: isMobile ? "1" : "0",
          skipProbe: false,
          isCollection: payment === "cod",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        allowManual?: boolean;
        action?: string;
        params?: Record<string, string>;
        code?: string;
      };

      if (!res.ok || !data.ok || !data.action || !data.params) {
        if (data.allowManual) {
          setManualStore(true);
          setEmapHint(
            data.error ||
              "綠界電子地圖目前無法使用，請改為手動輸入取貨門市代號與店名。",
          );
          return;
        }
        throw new Error(data.error || "無法開啟綠界電子地圖");
      }

      openEmapForm(data.action, data.params, !isMobile);
    } catch (err) {
      setManualStore(true);
      setError(err instanceof Error ? err.message : "電子地圖開啟失敗");
      setEmapHint("可改為下方手動輸入門市後結帳。");
    } finally {
      setEmapBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (lines.length === 0) {
      setError("購物車沒有商品，請先加入商品再結帳。");
      return;
    }
    if (!name.trim()) {
      setError("請填寫收件人姓名");
      return;
    }
    const normalized = normalizeTaiwanMobile(phone);
    if (!isValidTaiwanMobile(normalized)) {
      setError("請輸入正確的台灣手機號碼（09 開頭共 10 碼）");
      return;
    }
    if (needsStore) {
      if (storeCode.trim().length < 3) {
        setError("請選擇或輸入取貨門市代號（至少 3 碼）");
        return;
      }
      if (storeNameCvs.trim().length < 2) {
        setError("請填寫取貨門市名稱");
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          customerName: name.trim(),
          customerPhone: normalized,
          pickup,
          storeCode: storeCode.trim(),
          storeName: storeNameCvs.trim() || undefined,
          address: storeAddrCvs.trim() || undefined,
          payment: "cod",
          note: note.trim(),
          promoCode: promoCode.trim() || undefined,
          lines: lines.map((line) => ({
            productId: line.productId,
            name: line.name,
            price: line.price,
            quantity: line.quantity,
            size: line.size,
            colorId: line.colorId,
            colorName: line.colorName,
          })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        mode?: string;
        action?: string;
        params?: Record<string, string>;
        order?: {
          id: string;
          paymentCode?: string | null;
          totalAmount?: number;
          shippingFee?: number;
          discountAmount?: number;
          promoName?: string | null;
        };
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "建立訂單失敗");
      }

      if (data.mode === "live" && data.action && data.params) {
        onOrderPlaced({ mode: "live" });
        redirectToEcpay(data.action, data.params);
        return;
      }

      setOrderSummary({
        id: data.order?.id || "PS-LOCAL",
        total: data.order?.totalAmount ?? total,
        shippingFee: data.order?.shippingFee ?? shippingFee,
        discountAmount:
          data.order?.discountAmount ?? discountAmount ?? undefined,
        promoName:
          data.order?.promoName || previewPromo?.promoName || undefined,
        name: name.trim(),
        phone: normalized,
        pickup,
        payment,
        paymentCode: data.order?.paymentCode || undefined,
        mode: data.mode,
        message: data.message,
      });
      onOrderPlaced({ mode: data.mode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "結帳失敗");
    } finally {
      setBusy(false);
    }
  }

  if (orderSummary) {
    const pickupLabel =
      PICKUP_METHODS.find((item) => item.id === orderSummary.pickup)?.label ??
      orderSummary.pickup;
    const paymentLabel =
      availablePayments.find((item) => item.id === orderSummary.payment)
        ?.label ??
      PAYMENT_METHODS.find((item) => item.id === orderSummary.payment)
        ?.label ?? orderSummary.payment;
    const isCod = orderSummary.payment === "cod" || orderSummary.mode === "cod";

    return (
      <div
        id="checkout"
        className="scroll-mt-24 rounded-3xl border border-emerald-400/25 bg-emerald-400/10 p-5 sm:p-8"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />
          <div>
            <h2 className="text-xl font-bold text-white">
              {orderSummary.mode === "mock"
                ? "訂單已建立（示範模式）"
                : isCod
                  ? "訂單已成立（貨到付款）"
                  : "訂單已建立"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-50/90">
              {isCod
                ? orderSummary.message ||
                  `感謝 ${orderSummary.name} 於 ${storeName} 下單。賣家備貨出貨後，請至超商門市取貨並完成付款。`
                : `感謝 ${orderSummary.name} 於 ${storeName} 下單。正式環境將導向綠界 ECPay 完成付款，並同步至賣家訂單後台。`}
            </p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <dt className="text-slate-400">訂單編號</dt>
                <dd className="mt-1 font-mono font-semibold text-white">
                  {orderSummary.id}
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <dt className="text-slate-400">
                  {isCod ? "取貨時應付" : "應付金額"}
                </dt>
                <dd className="mt-1 font-semibold text-teal-200">
                  {formatTwd(orderSummary.total)}
                </dd>
                {(orderSummary.discountAmount || 0) > 0 ? (
                  <p className="mt-1 text-xs text-emerald-200/90">
                    已折抵 {formatTwd(orderSummary.discountAmount || 0)}
                    {orderSummary.promoName
                      ? `（${orderSummary.promoName}）`
                      : ""}
                  </p>
                ) : orderSummary.promoName ? (
                  <p className="mt-1 text-xs text-emerald-200/90">
                    已套用：{orderSummary.promoName}
                  </p>
                ) : null}
                {(orderSummary.shippingFee || 0) > 0 ? (
                  <p className="mt-1 text-xs text-slate-400">
                    含運費 {formatTwd(orderSummary.shippingFee || 0)}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <dt className="text-slate-400">取貨方式</dt>
                <dd className="mt-1 text-slate-100">{pickupLabel}</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <dt className="text-slate-400">付款方式</dt>
                <dd className="mt-1 text-slate-100">{paymentLabel}</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 sm:col-span-2">
                <dt className="text-slate-400">聯絡手機</dt>
                <dd className="mt-1 text-slate-100">
                  {formatTaiwanMobileDisplay(orderSummary.phone)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    );
  }

  const submitLabel =
    payment === "cod"
      ? `確認訂購・取貨付款 ${formatTwd(total)}`
      : `前往綠界付款・${formatTwd(total)}`;

  return (
    <section
      id="checkout"
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950 to-teal-950/30"
    >
      <div className="border-b border-white/10 px-5 py-5 sm:px-8 sm:py-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
          <Package className="h-3.5 w-3.5 text-teal-300" />
          一頁式結帳
        </div>
        <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
          填寫收件與付款資訊
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          支援 7-11／全家超商取貨付款。目前商品{" "}
          <span className="font-semibold text-teal-200">
            {formatTwd(subtotal)}
          </span>
          {discountAmount > 0 ? (
            <>
              －優惠{" "}
              <span className="font-semibold text-emerald-200">
                {formatTwd(discountAmount)}
              </span>
            </>
          ) : null}
          {shippingFee > 0 ? (
            <>
              ＋運費{" "}
              <span className="font-semibold text-teal-200">
                {formatTwd(shippingFee)}
              </span>
              （買家負擔）
            </>
          ) : previewPromo?.freeShipping ? (
            <>（免運優惠）</>
          ) : shippingPayer === "seller" ? (
            <>（運費由賣家負擔）</>
          ) : null}
          ，應付{" "}
          <span className="font-semibold text-teal-200">{formatTwd(total)}</span>
          。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-8 sm:py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="checkout-name" className="text-slate-300">
              收件人姓名
            </Label>
            <Input
              id="checkout-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：王小明"
              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="checkout-phone" className="text-slate-300">
              台灣手機號碼
            </Label>
            <Input
              id="checkout-phone"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="例如：0912345678"
              maxLength={20}
              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
            <MapPinned className="h-4 w-4 text-teal-300" />
            取貨方式
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PICKUP_METHODS.map((method) => (
              <label
                key={method.id}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-sm transition ${
                  pickup === method.id
                    ? "border-teal-300/40 bg-teal-400/10 text-teal-50"
                    : "border-white/10 bg-black/20 text-slate-300 hover:border-white/25"
                }`}
              >
                <input
                  type="radio"
                  name="pickup"
                  value={method.id}
                  checked={pickup === method.id}
                  onChange={() => setPickup(method.id)}
                  className="sr-only"
                />
                {method.label}
              </label>
            ))}
          </div>
        </div>

        {needsStore ? (
          <div className="space-y-3">
            <Label className="text-slate-300">
              {pickup === "family" ? "全家" : "7-11"}取貨門市
              {payment === "cod" ? "（代收／貨到付款）" : ""}
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={emapBusy}
                onClick={() => void openEmap()}
                className="border-teal-300/30 bg-teal-400/10 text-teal-50"
              >
                {emapBusy ? "開啟中…" : "開啟綠界電子地圖選店"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setManualStore(true);
                  setEmapHint("請填寫門市代號與店名（可於超商 App／官網查詢）。");
                }}
                className="border-white/15 bg-white/5 text-slate-200"
              >
                手動輸入門市
              </Button>
            </div>

            {emapHint ? (
              <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                {emapHint}
              </p>
            ) : null}

            {manualStore ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cvs-code" className="text-slate-300">
                    門市代號
                  </Label>
                  <Input
                    id="cvs-code"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.trim())}
                    placeholder={pickup === "family" ? "例：015138" : "例：123456"}
                    className="mt-1.5 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <Label htmlFor="cvs-name" className="text-slate-300">
                    門市名稱
                  </Label>
                  <Input
                    id="cvs-name"
                    value={storeNameCvs}
                    onChange={(e) => setStoreNameCvs(e.target.value)}
                    placeholder={
                      pickup === "family" ? "例：全家台北某某店" : "例：某某門市"
                    }
                    className="mt-1.5 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cvs-addr" className="text-slate-300">
                    門市地址（選填）
                  </Label>
                  <Input
                    id="cvs-addr"
                    value={storeAddrCvs}
                    onChange={(e) => setStoreAddrCvs(e.target.value)}
                    placeholder="方便核對取貨門市"
                    className="mt-1.5 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            ) : (
              <Input
                value={
                  storeNameCvs
                    ? `${storeNameCvs}${storeCode ? `（${storeCode}）` : ""}${
                        storeAddrCvs ? ` · ${storeAddrCvs}` : ""
                      }`
                    : storeCode
                }
                readOnly
                placeholder="請先以電子地圖選擇門市，或改手動輸入"
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              />
            )}
          </div>
        ) : null}

        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
            <CreditCard className="h-4 w-4 text-teal-300" />
            付款方式
          </p>
          {availablePayments.length === 0 ? (
            <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-3 text-sm text-amber-50">
              {shopPaymentsUnavailableMessage()}
            </p>
          ) : (
            <div className="grid gap-2">
              {availablePayments.map((method) => (
                <label
                  key={method.id}
                  className={`cursor-pointer rounded-xl border px-3 py-3 text-sm transition ${
                    payment === method.id
                      ? "border-teal-300/40 bg-teal-400/10 text-teal-50"
                      : "border-white/10 bg-black/20 text-slate-300 hover:border-white/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={method.id}
                    checked={payment === method.id}
                    onChange={() => setPayment(method.id)}
                    className="sr-only"
                  />
                  {method.label}
                </label>
              ))}
            </div>
          )}
          {payment === "cod" ? (
            <p className="mt-2 text-xs text-slate-500">
              貨到付款：訂單成立後賣家備貨出貨，您至超商取貨時付款。選店時會帶入代收門市。
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
            <Tag className="h-4 w-4 text-teal-300" />
            優惠活動
          </p>
          {promos.some((p) => p.active && p.autoApply) ? (
            <p className="mb-2 text-xs text-slate-500">
              符合條件時會自動套用最佳優惠；也可輸入折扣碼覆蓋。
            </p>
          ) : null}
          <Label htmlFor="checkout-promo" className="sr-only">
            優惠碼
          </Label>
          <Input
            id="checkout-promo"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="輸入優惠碼（選填）"
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            autoComplete="off"
          />
          {promoHint ? (
            <p
              className={`mt-2 text-xs ${
                promoCode.trim() && !previewPromo
                  ? "text-amber-200"
                  : "text-emerald-200/90"
              }`}
            >
              {promoHint}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="checkout-note" className="text-slate-300">
            備註（選填）
          </Label>
          <Input
            id="checkout-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：希望週五配達、包裝勿放發票"
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
          />
        </div>

        {error ? (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={busy || availablePayments.length === 0}
          className="h-12 w-full bg-teal-400 text-base text-slate-950 hover:bg-teal-300"
        >
          {busy ? "建立訂單中…" : submitLabel}
        </Button>
        <p className="text-xs leading-relaxed text-slate-500">
          送出後訂單直接成立（取貨時付款）。取貨付款完成後，賣家可於後台標示完成並列入撥款；平台抽成
          3% 於每月撥款時扣除。
        </p>
      </form>
    </section>
  );
}
