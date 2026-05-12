import sharp from "sharp"

function bufferLooksLikeHeif(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false
  const brand = buffer.toString("ascii", 8, 12).replace(/\0/g, "").trim()
  return /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|hevm|hevs)$/i.test(brand)
}

function looksLikeHeicInput(input: Buffer, opts: { originalFilename: string; mimeType: string }): boolean {
  const lowerName = (opts.originalFilename || "").toLowerCase()
  const mimeLower = (opts.mimeType || "").toLowerCase()
  return (
    bufferLooksLikeHeif(input) ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif") ||
    mimeLower.includes("heic") ||
    mimeLower.includes("heif")
  )
}

async function heicBufferToJpegBuffer(input: Buffer): Promise<Buffer> {
  const heicConvert = (await import("heic-convert")).default as (opts: {
    buffer: Buffer
    format: "JPEG"
    quality: number
  }) => Promise<ArrayBuffer | Buffer>

  const rawJpeg = await heicConvert({
    buffer: input,
    format: "JPEG",
    quality: 0.92,
  })
  return Buffer.isBuffer(rawJpeg) ? rawJpeg : Buffer.from(rawJpeg)
}

/**
 * Returns a buffer Sharp can decode. HEIC/HEIF is converted to JPEG first via `heic-convert`.
 *
 * Important: Sharp's `metadata()` can succeed on some HEIC blobs while full decode/WebP fails.
 * For anything that looks like HEIC (ftyp, extension, or MIME), we run `heic-convert` first.
 */
export async function decodeImageBufferForSharp(
  input: Buffer,
  opts: { originalFilename: string; mimeType: string },
): Promise<Buffer> {
  const isHeicish = looksLikeHeicInput(input, opts)

  if (isHeicish) {
    try {
      return await heicBufferToJpegBuffer(input)
    } catch {
      // Mis-labeled file or decoder edge case — fall through to Sharp.
    }
  }

  try {
    await sharp(input, { failOn: "none" }).metadata()
    return input
  } catch {
    if (isHeicish) {
      try {
        return await heicBufferToJpegBuffer(input)
      } catch (heicErr) {
        const hint = heicErr instanceof Error ? heicErr.message : "decode failed"
        throw new Error(
          `Could not read this HEIC/HEIF image (${hint}). Try exporting as JPEG or PNG from Photos, or use a JPG/PNG file.`,
        )
      }
    }
    throw new Error("Unsupported or corrupted image")
  }
}
