import { ImageResponse } from "next/og"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { fetchImageAsPngDataUri } from "@/lib/og/fetch-image-for-og"
import { STANDARD_OG_SIZE } from "@/lib/og/og-size"
import { absoluteUrl } from "@/lib/site-metadata"

export const LISTING_OG_SIZE = STANDARD_OG_SIZE

/** ~two-thirds image — matches marketplace link previews (Reverb / iMessage). */
const IMAGE_SECTION_HEIGHT = 422
const FOOTER_HEIGHT = STANDARD_OG_SIZE.height - IMAGE_SECTION_HEIGHT

/** Inter Latin (WOFF) — Satori renders clean type vs generic fallback. */
const INTER_400_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-400-normal.woff"
const INTER_700_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-700-normal.woff"

const SYSTEM_UI =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

let interFontsResolved: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer } | null> | null = null

/** Loads Inter once; returns null if CDN unreachable so OG route still returns PNG. */
function getInterFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer } | null> {
  if (!interFontsResolved) {
    interFontsResolved = (async () => {
      try {
        const [r400, r700] = await Promise.all([
          fetch(INTER_400_URL),
          fetch(INTER_700_URL),
        ])
        if (!r400.ok || !r700.ok) return null
        const [regular, bold] = await Promise.all([r400.arrayBuffer(), r700.arrayBuffer()])
        return { regular, bold }
      } catch {
        return null
      }
    })()
  }
  return interFontsResolved
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

function ogSiteDomainLabel(): string {
  try {
    const h = new URL(publicSiteOrigin()).hostname
    return h.replace(/^www\./, "")
  } catch {
    return "reswell.app"
  }
}

/**
 * Share art for `/l/[listing]` — marketplace-style card: large photo on white,
 * then a shaded strip with bold title + domain only (matches iMessage / Reverb previews).
 *
 * `line2` is accepted for API compatibility (e.g. boards browse) but not drawn — previews stay title + domain only.
 */
export async function listingShareImageResponse(opts: {
  title: string
  line2?: string
  /** Public HTTPS URL (e.g. Supabase storage). */
  photoUrl?: string | null
  sold?: boolean
}) {
  const inter = await getInterFonts()
  const title = truncate(opts.title, 82)
  const brandFallbackPhotoUrl = absoluteUrl("/og-image.jpg")
  const primary = opts.photoUrl?.trim()
  let imgSrc: string
  if (primary) {
    const dataUri = await fetchImageAsPngDataUri(primary)
    if (dataUri) {
      imgSrc = dataUri
    } else {
      const fallback = await fetchImageAsPngDataUri(brandFallbackPhotoUrl)
      imgSrc = fallback ?? brandFallbackPhotoUrl
    }
  } else {
    const fallback = await fetchImageAsPngDataUri(brandFallbackPhotoUrl)
    imgSrc = fallback ?? brandFallbackPhotoUrl
  }
  const domain = ogSiteDomainLabel()
  const fontFamily = inter ? "Inter" : SYSTEM_UI

  const jsx = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        fontFamily,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
        {/* Hero — white field + centered product (contain), Reverb-style */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: IMAGE_SECTION_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          {opts.sold ? (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                zIndex: 2,
                padding: "6px 14px",
                borderRadius: 6,
                background: "rgba(255, 255, 255, 0.95)",
                color: "#dc2626",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 0.2,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              Sold
            </div>
          ) : null}
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 20px",
              boxSizing: "border-box",
            }}
          >
            <img
              src={imgSrc}
              alt=""
              width={1160}
              height={IMAGE_SECTION_HEIGHT - 24}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                objectPosition: "center",
              }}
            />
          </div>
        </div>

        {/* Title + domain only (top border separates hero from meta, no extra pixel vs 630 canvas) */}
        <div
          style={{
            width: "100%",
            height: FOOTER_HEIGHT,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 40px",
            background: "#ebebed",
            boxSizing: "border-box",
            borderTop: "1px solid #e5e5ea",
          }}
        >
          <div
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: "#000000",
              lineHeight: 1.22,
              letterSpacing: -0.35,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 21,
              fontWeight: 400,
              color: "#636366",
              marginTop: 10,
              letterSpacing: 0.1,
            }}
          >
            {domain}
          </div>
        </div>
      </div>
  )

  return new ImageResponse(jsx, {
    ...LISTING_OG_SIZE,
    ...(inter
      ? {
          fonts: [
            { name: "Inter", data: inter.regular, weight: 400, style: "normal" },
            { name: "Inter", data: inter.bold, weight: 700, style: "normal" },
          ],
        }
      : {}),
  })
}
