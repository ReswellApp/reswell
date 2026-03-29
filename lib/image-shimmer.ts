/**
 * Shimmer SVG encoded as base64 for use as a blurDataURL on remote images.
 * Next.js Image's placeholder="blur" fades from this into the loaded image,
 * eliminating the jarring "pop" of images loading into blank space.
 */
const shimmerSvg = (w: number, h: number) =>
  `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#f0f0f0"/>
        <stop offset="50%"  stop-color="#e4e4e4"/>
        <stop offset="100%" stop-color="#f0f0f0"/>
        <animateTransform attributeName="gradientTransform" type="translate"
          from="-1 0" to="2 0" dur="1.4s" repeatCount="indefinite"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
  </svg>`

const toBase64 = (str: string) =>
  typeof window === "undefined"
    ? Buffer.from(str).toString("base64")
    : window.btoa(unescape(encodeURIComponent(str)))

export function shimmerDataUrl(w = 700, h = 700): string {
  return `data:image/svg+xml;base64,${toBase64(shimmerSvg(w, h))}`
}

/** Pre-built square shimmer — use as blurDataURL for listing card thumbnails. */
export const squareShimmer = shimmerDataUrl(700, 700)

/** Pre-built portrait shimmer (3:4) — use for surfboard / portrait listing images. */
export const portraitShimmer = shimmerDataUrl(600, 800)

/** Pre-built wide shimmer — use for banner / hero images. */
export const wideShimmer = shimmerDataUrl(1200, 400)
