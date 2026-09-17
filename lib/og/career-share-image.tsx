import { ImageResponse } from "next/og"
import { brandShareImageResponse } from "@/lib/og/brand-share-image"
import { publicImageAsPngDataUri } from "@/lib/og/fetch-image-for-og"
import { STANDARD_OG_SIZE } from "@/lib/og/og-size"

export const CAREER_OG_SIZE = STANDARD_OG_SIZE

const CAREERS_OG_PHOTO = "/images/careers/headline-barrel.jpg"

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

/**
 * Photo share art for careers pages — barrel hero with the role (or hub) title overlaid.
 */
export async function careerShareImageResponse(opts: {
  eyebrow: string
  headline: string
  subhead?: string
  photoPath?: string
}) {
  const photoPath = opts.photoPath ?? CAREERS_OG_PHOTO
  const imgSrc = await publicImageAsPngDataUri(photoPath, {
    width: CAREER_OG_SIZE.width,
    height: CAREER_OG_SIZE.height,
    fit: "cover",
    position: "left",
  })

  if (!imgSrc) {
    return brandShareImageResponse({
      headline: opts.headline,
      subhead: opts.subhead,
      footer: "reswell.app · Careers",
      tone: "dark",
    })
  }

  const eyebrow = truncate(opts.eyebrow, 48)
  const headline = truncate(opts.headline, 72)
  const subhead = opts.subhead ? truncate(opts.subhead, 80) : undefined
  const headlineSize = headline.length > 36 ? 50 : 58

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <img
          src={imgSrc}
          alt=""
          width={CAREER_OG_SIZE.width}
          height={CAREER_OG_SIZE.height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CAREER_OG_SIZE.width,
            height: CAREER_OG_SIZE.height,
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(180deg, rgba(4,7,14,0.42) 0%, rgba(4,7,14,0.22) 38%, rgba(4,7,14,0.72) 72%, rgba(4,7,14,0.88) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: "100%",
            height: "100%",
            paddingTop: 52,
            paddingBottom: 52,
            paddingLeft: 64,
            paddingRight: 64,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "rgba(249,249,242,0.8)",
              marginBottom: 14,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: headlineSize,
              fontWeight: 700,
              color: "#F9F9F2",
              lineHeight: 1.12,
              maxWidth: 820,
            }}
          >
            {headline}
          </div>
          {subhead ? (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 500,
                color: "rgba(249,249,242,0.86)",
                lineHeight: 1.3,
                marginTop: 14,
              }}
            >
              {subhead}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...CAREER_OG_SIZE },
  )
}
