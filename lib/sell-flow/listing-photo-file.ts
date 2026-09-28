/**
 * Which files count as listing photos, including the types Windows hands the browser.
 *
 * Chrome on Windows often labels JPEGs as `image/jpg` or `image/pjpeg`, saves them as
 * `.jfif`, or leaves HEIC / JFIF with an empty MIME type. `accept="image/*"` also hides
 * extensions Windows has not registered (HEIC without the HEIF codec, JFIF, sometimes WebP).
 * Bytes win over the label when they disagree — iPhone photos copied to a PC are often
 * HEIC data under a `.jpg` name.
 */

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/pipeg": "image/jpeg",
  "image/x-citrix-jpeg": "image/jpeg",
  "image/x-citrix-pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/x-citrix-png": "image/png",
  "image/x-ms-bmp": "image/bmp",
  "image/x-bmp": "image/bmp",
  "image/x-windows-bmp": "image/bmp",
  "image/tif": "image/tiff",
  "image/x-tiff": "image/tiff",
  "image/heic-sequence": "image/heic",
  "image/heif-sequence": "image/heif",
}

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  dib: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
}

/** Explicit MIME + extensions so the Windows file dialog does not hide unregistered types. */
export const LISTING_PHOTO_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/*",
  ".jpg",
  ".jpeg",
  ".jpe",
  ".jfif",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".dib",
].join(",")

const HEIC_BRAND_RE = /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|hevm|hevs)$/i
const AVIF_BRAND_RE = /^(avif|avis)$/i

export function canonicalDeclaredMime(type: string | null | undefined): string {
  const mime = (type || "").toLowerCase().split(";")[0]?.trim() ?? ""
  if (!mime) return ""
  return MIME_ALIASES[mime] ?? mime
}

export function extensionMime(fileName: string | null | undefined): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName || "")
  if (!match?.[1]) return null
  return EXTENSION_MIME[match[1].toLowerCase()] ?? null
}

function brandAt(bytes: Uint8Array): string {
  if (bytes.length < 12) return ""
  const box = String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!)
  if (box !== "ftyp") return ""
  return String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)
    .replace(/\0/g, "")
    .trim()
}

/** Best-effort type from the file header. Returns null when the bytes are not a known photo. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png"
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif"
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!) === "WEBP"
  ) {
    return "image/webp"
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp"
  if (bytes.length >= 4) {
    const leTiff = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00
    const beTiff = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a
    if (leTiff || beTiff) return "image/tiff"
  }
  const brand = brandAt(bytes)
  if (AVIF_BRAND_RE.test(brand)) return "image/avif"
  if (HEIC_BRAND_RE.test(brand)) return "image/heic"
  return null
}

export function isListingPhotoFile(file: { type?: string | null; name?: string | null }): boolean {
  const mime = canonicalDeclaredMime(file.type)
  if (mime === "image/svg+xml") return false
  if (mime.startsWith("image/")) return true
  return extensionMime(file.name) != null
}

/**
 * MIME to stamp on a decode blob. Prefers a real image type over `image/jpeg` so a PNG
 * with an empty Windows file type is not decoded as JPEG.
 */
export function mimeForImageDecode(type: string | null | undefined, fileName: string): string {
  const declared = canonicalDeclaredMime(type)
  if (declared.startsWith("image/") && declared !== "image/svg+xml") return declared
  return extensionMime(fileName) ?? "image/jpeg"
}

function fileWithType(file: File, type: string): File {
  if ((file.type || "").toLowerCase() === type) return file
  return new File([file], file.name || "photo", { type, lastModified: file.lastModified })
}

/**
 * Rewrap a picked file so `createImageBitmap` sees a MIME the browser actually decodes.
 * Avoids copying bytes when the label is already empty — the worker stamps the extension MIME.
 * Always rewraps when the header disagrees with the name (HEIC bytes in a `.jpg`).
 */
export async function normalizeListingImageFile(file: File): Promise<File> {
  const declared = canonicalDeclaredMime(file.type)
  const fromExt = extensionMime(file.name)
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const sniffed = sniffImageMime(head)

  const declaredImage =
    declared.startsWith("image/") && declared !== "image/svg+xml" ? declared : ""

  if (sniffed === "image/heic" || sniffed === "image/avif" || sniffed === "image/tiff") {
    if (sniffed !== declaredImage) {
      // Extension already routes this type. Rewrapping copies the whole file — painful on iPhone.
      if (fromExt === sniffed || (sniffed === "image/heic" && fromExt === "image/heif")) return file
      return fileWithType(file, sniffed)
    }
  } else if (sniffed && declaredImage && sniffed !== declaredImage) {
    // PNG/JPEG bytes under the other MIME. Chrome will not sniff past a wrong type.
    return fileWithType(file, sniffed)
  } else if (sniffed && !declaredImage && fromExt && sniffed !== fromExt) {
    // Empty Windows MIME, and the name lies (PNG saved as photo.jpg, HEIC handled above).
    return fileWithType(file, sniffed)
  }

  const target = declaredImage || sniffed || fromExt || ""
  if (!target) return file
  if ((file.type || "").toLowerCase() === target) return file
  // Empty type: keep the original File (no extra copy). Callers stamp MIME at decode time.
  if (!file.type && sniffed !== "image/heic" && sniffed !== "image/avif" && sniffed !== "image/tiff") {
    return file
  }
  return fileWithType(file, target)
}
