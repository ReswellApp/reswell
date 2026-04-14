import { ImageResponse } from "next/og"
import { STANDARD_OG_SIZE } from "@/lib/og/og-size"

export const LISTING_OG_SIZE = STANDARD_OG_SIZE

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

/**
 * Share art for marketplace listing URLs — title, optional price line, optional photo.
 */
export function listingShareImageResponse(opts: {
  title: string
  line2?: string
  /** Public HTTPS URL (e.g. Supabase storage). */
  photoUrl?: string | null
  sold?: boolean
}) {
  const title = truncate(opts.title, 64)
  const line2 = opts.line2 ? truncate(opts.line2, 120) : undefined
  const photoUrl = opts.photoUrl?.trim() || undefined

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: 64,
            paddingRight: 48,
            gap: 20,
            minWidth: 0,
          }}
        >
          {opts.sold ? (
            <div
              style={{
                alignSelf: "flex-start",
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(248, 113, 113, 0.95)",
                color: "#450a0a",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              SOLD
            </div>
          ) : null}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "#f8fafc",
              lineHeight: 1.1,
              letterSpacing: -1.2,
            }}
          >
            {title}
          </div>
          {line2 ? (
            <div
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: "#cbd5e1",
                lineHeight: 1.35,
              }}
            >
              {line2}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 24,
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 28 }}>🌊</span>
            <span>reswell.app</span>
          </div>
        </div>

        <div
          style={{
            width: 480,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              width={400}
              height={400}
              style={{
                width: 400,
                height: 400,
                objectFit: "cover",
                borderRadius: 24,
                border: "4px solid rgba(148, 163, 184, 0.35)",
              }}
            />
          ) : (
            <div
              style={{
                width: 400,
                height: 400,
                borderRadius: 24,
                background: "linear-gradient(160deg, rgba(56, 189, 248, 0.35) 0%, rgba(15, 23, 42, 0.9) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e2e8f0",
                fontSize: 120,
                fontWeight: 700,
              }}
            >
              R
            </div>
          )}
        </div>
      </div>
    ),
    { ...LISTING_OG_SIZE },
  )
}
