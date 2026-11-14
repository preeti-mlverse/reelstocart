import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const runtime = "edge";
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: 80, background: "linear-gradient(135deg, #0c0c0f 0%, #2a1018 100%)", color: "#f4f4f6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#e8536b" }} />
          {SITE.name}
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 40, lineHeight: 1.05, letterSpacing: -2 }}>
          Shop the look from any reel or photo
        </div>
        <div style={{ fontSize: 32, marginTop: 28, color: "#c9c9d2" }}>
          Upload a screenshot · AI finds every garment · prices in rupees
        </div>
      </div>
    ),
    size,
  );
}
