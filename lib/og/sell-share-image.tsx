import { ImageResponse } from "next/og"

export const SELL_OG_SIZE = { width: 1200, height: 630 } as const

/** Share / Open Graph art for the sell flow — generated at request time (no static asset to maintain). */
export function sellShareImageResponse() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingLeft: 72,
          paddingRight: 72,
          background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 42%, #f1f5f9 100%)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: "linear-gradient(180deg, #0d9488 0%, #0f766e 100%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 920 }}>
          <div
            style={{
              fontSize: 58,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.08,
              letterSpacing: -1.5,
            }}
          >
            Sell your surfboard on Reswell
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 500,
              color: "#334155",
              lineHeight: 1.35,
            }}
          >
            List with photos and details, set your price, and reach buyers on the surf marketplace.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            left: 72,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 24,
            color: "#64748b",
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 28 }}>🌊</span>
          <span>reswell.app · Sell</span>
        </div>
      </div>
    ),
    { ...SELL_OG_SIZE },
  )
}
