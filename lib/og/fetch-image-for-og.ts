import sharp from "sharp"

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/jpeg,image/png,image/*,*/*;q=0.8",
} as const

const MAX_DIMENSION = 1400

/**
 * Fetches a public image and returns a PNG data URI that Satori / {@link ImageResponse} can render.
 *
 * Remote `<img src="https://…">` in OG JSX often renders blank: WebP/AVIF may be unsupported, and
 * some CDNs block requests without a browser-like User-Agent. Decoding via sharp covers WebP/AVIF/JPEG/PNG.
 */
export async function fetchImageAsPngDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return null
    const png = await sharp(buf)
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return null
  }
}
