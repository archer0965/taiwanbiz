"use client";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import type { QuotationDocument, QuotationPartyB } from "@/lib/quotation";
import {
  ArrowLeft,
  CheckCircle2,
  Eraser,
  FileText,
  Moon,
  Printer,
  Sun,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Props = {
  document: QuotationDocument;
};

export function QuotationDocumentView({ document: initial }: Props) {
  const [partyB, setPartyB] = useState<QuotationPartyB>(initial.partyB);
  const [printMode, setPrintMode] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [agreedAt, setAgreedAt] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [message, setMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const snapshot = canvas.toDataURL();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0f172a";
      if (hasSignature) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = snapshot;
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only bootstrap canvas sizing
  }, []);

  function point(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    setAgreed(false);
    setAgreedAt(null);
  }

  function handleAgree() {
    if (!hasSignature) {
      setMessage("請先於簽名欄簽署後，再點擊同意並送出。");
      return;
    }
    const stamp = new Date().toLocaleString("zh-TW", { hour12: false });
    setAgreed(true);
    setAgreedAt(stamp);
    setMessage("已完成電子確認。此行為與書面簽署具同等意思表示效力（於法律允許範圍內）。");
  }

  function handlePrint() {
    window.print();
  }

  function updatePartyB<K extends keyof QuotationPartyB>(key: K, value: string) {
    setPartyB((prev) => ({ ...prev, [key]: value }));
  }

  const shellClass = printMode
    ? "bg-slate-200 text-slate-900"
    : "bg-slate-950 text-slate-100";

  return (
    <div className={`min-h-screen ${shellClass}`}>
      <div className="quotation-toolbar sticky top-0 z-20 border-b border-black/10 bg-slate-900/95 text-slate-100 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回總管
            </Link>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <FileText className="h-4 w-4 text-teal-300" />
                服務確認單與報價單
              </p>
              <p className="truncate text-xs text-slate-400">
                {initial.quotationNo} · {partyB.storeName}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPrintMode((v) => !v)}
              className="border-white/15 bg-transparent text-slate-100 hover:bg-white/10"
            >
              {printMode ? (
                <>
                  <Moon className="h-4 w-4" />
                  深色預覽
                </>
              ) : (
                <>
                  <Sun className="h-4 w-4" />
                  列印白底
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="bg-teal-400 text-slate-950 hover:bg-teal-300"
            >
              <Printer className="h-4 w-4" />
              列印 / 另存 PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] px-3 py-6 sm:px-4 print:max-w-none print:p-0">
        <article
          className={`quotation-sheet mx-auto overflow-hidden rounded-sm border shadow-xl print:rounded-none print:border-0 print:shadow-none ${
            printMode
              ? "border-slate-300 bg-white text-slate-900"
              : "border-white/10 bg-slate-900 text-slate-100"
          }`}
        >
          <header
            className={`border-b px-6 py-6 sm:px-8 ${
              printMode
                ? "border-slate-200 bg-gradient-to-br from-slate-50 to-white"
                : "border-white/10 bg-slate-950/80"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <BrandLogo size={52} />
                <div>
                  <p
                    className={`font-[family-name:var(--font-display)] text-xs font-semibold tracking-[0.18em] uppercase ${
                      printMode ? "text-teal-700" : "text-teal-300"
                    }`}
                  >
                    Service Quotation & Agreement
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    服務確認單與報價單
                  </h1>
                  <p
                    className={`mt-1 text-sm ${printMode ? "text-slate-600" : "text-slate-400"}`}
                  >
                    {initial.partyA.legalName}｜接案報價與服務條款摘要
                  </p>
                </div>
              </div>
              <div
                className={`text-right text-xs ${printMode ? "text-slate-600" : "text-slate-400"}`}
              >
                <p>
                  單號{" "}
                  <span className="font-mono font-semibold text-inherit">
                    {initial.quotationNo}
                  </span>
                </p>
                <p className="mt-1">開立日期 {initial.issuedAt}</p>
                <p className="mt-1">store_id：{partyB.storeId}</p>
              </div>
            </div>
          </header>

          <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-7">
            <section className="grid gap-4 md:grid-cols-2">
              <PartyCard
                title="甲方（服務商）"
                printMode={printMode}
                rows={[
                  ["公司／品牌", initial.partyA.legalName],
                  ["英文名稱", initial.partyA.brandEn],
                  ["聯絡 Email", initial.partyA.email],
                  ["官方 LINE", initial.partyA.lineId],
                ]}
              />
              <div
                className={`rounded-xl border p-4 ${
                  printMode
                    ? "border-slate-200 bg-slate-50/80"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <h2 className="text-sm font-bold tracking-wide">乙方（店家）</h2>
                <div className="mt-3 grid gap-2.5 text-sm">
                  <EditableRow
                    label="店家名稱"
                    value={partyB.storeName}
                    printMode={printMode}
                    onChange={(v) => updatePartyB("storeName", v)}
                  />
                  <EditableRow
                    label="負責人"
                    value={partyB.contactName}
                    printMode={printMode}
                    onChange={(v) => updatePartyB("contactName", v)}
                  />
                  <EditableRow
                    label="聯絡電話"
                    value={partyB.phone}
                    printMode={printMode}
                    onChange={(v) => updatePartyB("phone", v)}
                  />
                  <EditableRow
                    label="LINE ID"
                    value={partyB.lineId}
                    printMode={printMode}
                    onChange={(v) => updatePartyB("lineId", v)}
                  />
                  <EditableRow
                    label="Email"
                    value={partyB.email}
                    printMode={printMode}
                    onChange={(v) => updatePartyB("email", v)}
                  />
                </div>
              </div>
            </section>

            <section
              className={`rounded-xl border p-4 sm:p-5 ${
                printMode
                  ? "border-slate-200"
                  : "border-white/10"
              }`}
            >
              <h2 className="text-sm font-bold">選擇方案明細</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr
                      className={
                        printMode
                          ? "bg-slate-100 text-slate-700"
                          : "bg-white/5 text-slate-300"
                      }
                    >
                      <th className="border px-3 py-2 text-left font-semibold">項目</th>
                      <th className="border px-3 py-2 text-left font-semibold">內容</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["方案系列", initial.plan.seriesLabel],
                      ["方案名稱", initial.plan.planName],
                      ["月費金額", initial.plan.monthlyPriceLabel],
                      ["建置費", initial.plan.setupFeeLabel],
                      ["平台抽成比例", initial.plan.commissionLabel],
                      ["服務／維運範圍", initial.plan.serviceScope],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td
                          className={`border px-3 py-2 font-medium ${
                            printMode ? "bg-slate-50 text-slate-700" : "bg-white/[0.03]"
                          }`}
                        >
                          {label}
                        </td>
                        <td className="border px-3 py-2">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className={`rounded-xl border p-4 sm:p-5 ${
                printMode
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-amber-400/25 bg-amber-400/10"
              }`}
            >
              <h2 className="text-sm font-bold">創始優惠與試用條款</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex gap-2">
                  <span aria-hidden>🎁</span>
                  <span>
                    「{initial.founderPromo.trialLabel}」— 試用期內享全功能體驗，試用結束前可決定是否正式訂閱。
                  </span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>✨</span>
                  <span>
                    「{initial.founderPromo.founderLabel}」— 名額以實際確認順序為準，終身折扣適用後續續訂與升降級後之月費（建置費已適用創始優惠 NT$ 0）。
                  </span>
                </li>
              </ul>
            </section>

            <section
              className={`rounded-xl border p-4 sm:p-5 ${
                printMode ? "border-slate-200" : "border-white/10"
              }`}
            >
              <h2 className="text-sm font-bold">重要合約條款摘要</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                {initial.termsSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <p
                className={`mt-3 text-xs ${printMode ? "text-slate-500" : "text-slate-400"}`}
              >
                完整條款：網站 /terms 與 /privacy。若本摘要與個別訂單有衝突，以雙方簽署之個別文件為準。
              </p>
            </section>

            <section
              className={`rounded-xl border p-4 sm:p-5 ${
                printMode ? "border-slate-200" : "border-white/10"
              }`}
            >
              <h2 className="text-sm font-bold">簽署與確認區</h2>
              <p
                className={`mt-2 text-sm ${printMode ? "text-slate-600" : "text-slate-400"}`}
              >
                乙方於下方簽名或點擊「同意並送出」，即表示已閱讀、瞭解並同意本報價單與服務確認單所載條件，願受其拘束（於法律允許範圍內，與書面簽署具同等意思表示效力）。
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wide">
                      乙方電子簽名
                    </p>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="quotation-toolbar inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 print:hidden"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      清除
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    className={`h-36 w-full cursor-crosshair rounded-lg border ${
                      printMode
                        ? "border-slate-300 bg-white"
                        : "border-white/20 bg-white"
                    }`}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={() => {
                      drawing.current = false;
                    }}
                  />
                </div>
                <div className="flex flex-col justify-between gap-3">
                  <div
                    className={`rounded-lg border px-3 py-3 text-sm ${
                      printMode
                        ? "border-slate-200 bg-slate-50"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p>
                      簽署人：
                      <span className="font-semibold">{partyB.contactName}</span>
                    </p>
                    <p className="mt-1">
                      店家：
                      <span className="font-semibold">{partyB.storeName}</span>
                    </p>
                    <p className="mt-1">
                      確認狀態：{" "}
                      {agreed ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          已同意（{agreedAt}）
                        </span>
                      ) : (
                        <span className="text-amber-700">尚未確認</span>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAgree}
                    className="quotation-toolbar w-full bg-slate-900 text-white hover:bg-slate-800 print:hidden"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    點擊同意並送出
                  </Button>
                  {message ? (
                    <p
                      className={`quotation-toolbar text-xs print:hidden ${
                        agreed ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-6 pt-2 sm:grid-cols-2">
                <SignatureLine label="甲方簽署／用印" sub="拓脈（Nova Crest Pulse）" />
                <SignatureLine
                  label="乙方簽署／用印"
                  sub={`${partyB.storeName}／${partyB.contactName}`}
                />
              </div>
            </section>

            <footer
              className={`border-t pt-4 text-center text-[11px] ${
                printMode
                  ? "border-slate-200 text-slate-500"
                  : "border-white/10 text-slate-500"
              }`}
            >
              本文件由拓脈（Nova Crest Pulse）系統產生，僅供接案洽談與服務確認之用。
              諮詢：{initial.partyA.email} · LINE {initial.partyA.lineId}
            </footer>
          </div>
        </article>
      </div>

    </div>
  );
}

function PartyCard({
  title,
  rows,
  printMode,
}: {
  title: string;
  rows: [string, string][];
  printMode: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        printMode
          ? "border-slate-200 bg-slate-50/80"
          : "border-white/10 bg-white/5"
      }`}
    >
      <h2 className="text-sm font-bold tracking-wide">{title}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr]"
          >
            <dt className={printMode ? "text-slate-500" : "text-slate-400"}>
              {label}
            </dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EditableRow({
  label,
  value,
  onChange,
  printMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  printMode: boolean;
}) {
  return (
    <label className="grid grid-cols-[5.5rem_1fr] items-center gap-2 sm:grid-cols-[6rem_1fr]">
      <span className={printMode ? "text-slate-500" : "text-slate-400"}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-md border px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-500/40 print:border-0 print:bg-transparent print:px-0 print:py-0 ${
          printMode
            ? "border-slate-200 bg-white text-slate-900"
            : "border-white/15 bg-slate-950/40 text-slate-100"
        }`}
      />
    </label>
  );
}

function SignatureLine({ label, sub }: { label: string; sub: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500">{label}</p>
      <div className="mt-8 border-b border-slate-400" />
      <p className="mt-2 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
