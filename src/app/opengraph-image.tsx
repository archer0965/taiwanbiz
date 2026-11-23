import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "拓脈｜美業與美髮極速預約官網";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background:
            "linear-gradient(135deg, #2a221c 0%, #3a2f28 45%, #1f1915 100%)",
          color: "#f7efe8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: "0.2em",
            color: "#e8d5c8",
            fontWeight: 600,
          }}
        >
          拓脈 · Nova Crest Pulse
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 58,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            <span>美業與美髮工作室的</span>
            <span>極速預約官網</span>
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.45, maxWidth: 860, color: "#f0e4da" }}>
            線上預約、防撞期排班、離峰自動折扣與 LINE 即時通知，開店當日即可接單。
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#c4a090" }}>
          防撞期 · 離峰折扣 · LINE 通知 · 創始早鳥
        </div>
      </div>
    ),
    size,
  );
}
