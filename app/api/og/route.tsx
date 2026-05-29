import { ImageResponse } from "next/og"

export const runtime = "edge"

const WIDTH = 1200
const HEIGHT = 630

/**
 * Branded fallback Open Graph image, rendered on demand from a page title.
 * Used automatically for managed pages that don't set a custom share image.
 * Example: /api/og?title=Browse%20surfboards&subtitle=Buy%20%26%20sell
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get("title") || "Reswell").slice(0, 120)
  const subtitle = (searchParams.get("subtitle") || "Buy & sell surfboards").slice(0, 120)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1f3a 0%, #0e3a5f 55%, #1488c2 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>
          Reswell
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.82)" }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.7)" }}>
          reswell.app
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}
