import { ImageResponse } from "next/og"
import { STANDARD_OG_SIZE } from "@/lib/og/og-size"

export const BRAND_OG_SIZE = STANDARD_OG_SIZE

type Tone = "light" | "dark"

const toneStyles: Record<
  Tone,
  { bg: string; accent: string; headline: string; sub: string; footer: string }
> = {
  light: {
    bg: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 42%, #f1f5f9 100%)",
    accent: "linear-gradient(180deg, #0d9488 0%, #0f766e 100%)",
    headline: "#0f172a",
    sub: "#334155",
    footer: "#64748b",
  },
  dark: {
    bg: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 48%, #0f172a 100%)",
    accent: "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)",
    headline: "#f8fafc",
    sub: "#cbd5e1",
    footer: "#94a3b8",
  },
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

/**
 * Generic share art for marketing and hub pages — generated at request time.
 */
export function brandShareImageResponse(opts: {
  headline: string
  subhead?: string
  footer?: string
  tone?: Tone
}) {
  const tone = opts.tone ?? "light"
  const palette = toneStyles[tone]
  const headline = truncate(opts.headline, 72)
  const subhead = opts.subhead ? truncate(opts.subhead, 140) : undefined
  const footer = opts.footer ?? "reswell.app"

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
          background: palette.bg,
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
            background: palette.accent,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: palette.headline,
              lineHeight: 1.08,
              letterSpacing: -1.5,
            }}
          >
            {headline}
          </div>
          {subhead ? (
            <div
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: palette.sub,
                lineHeight: 1.35,
              }}
            >
              {subhead}
            </div>
          ) : null}
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
            color: palette.footer,
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 28 }}>🌊</span>
          <span>{footer}</span>
        </div>
      </div>
    ),
    { ...BRAND_OG_SIZE },
  )
}
