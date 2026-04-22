import sharp from "sharp"

/** Stored square edge length; UI uses a circle with `object-cover` (uniform scale + crop). */
const AVATAR_EDGE_PX = 512

function bufferLooksLikeHeif(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false
  const brand = buffer.toString("ascii", 8, 12).replace(/\0/g, "").trim()
  return /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|hevm|hevs)$/i.test(brand)
}

async function decodeWithHeifFallback(
  buffer: Buffer,
  lowerName: string,
  mimeLower: string,
): Promise<Buffer> {
  try {
    await sharp(buffer, { failOn: "none" }).metadata()
    return buffer
  } catch {
    const tryHeic =
      bufferLooksLikeHeif(buffer) ||
      lowerName.endsWith(".heic") ||
      lowerName.endsWith(".heif") ||
      mimeLower.includes("heic") ||
      mimeLower.includes("heif")

    if (!tryHeic) {
      throw new Error("Unsupported or corrupted image")
    }

    const heicConvert = (await import("heic-convert")).default as (opts: {
      buffer: Buffer
      format: "JPEG"
      quality: number
    }) => Promise<ArrayBuffer | Buffer>

    const rawJpeg = await heicConvert({
      buffer,
      format: "JPEG",
      quality: 0.92,
    })
    return Buffer.isBuffer(rawJpeg) ? rawJpeg : Buffer.from(rawJpeg)
  }
}

/**
 * Scales uniformly (no stretch), center-crops to a square with saliency-aware crop,
 * then encodes WebP — matches circular `object-cover` display without distortion.
 */
export async function processProfileAvatarToWebp(
  input: Buffer,
  opts: { originalFilename: string; mimeType: string },
): Promise<Buffer> {
  const lowerName = (opts.originalFilename || "").toLowerCase()
  const mimeLower = (opts.mimeType || "").toLowerCase()

  const decoded = await decodeWithHeifFallback(input, lowerName, mimeLower)

  return sharp(decoded, { failOn: "none" })
    .rotate()
    .resize(AVATAR_EDGE_PX, AVATAR_EDGE_PX, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .webp({ quality: 88, effort: 4 })
    .toBuffer()
}
