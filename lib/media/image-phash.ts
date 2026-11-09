/**
 * 64-bit difference hash (dHash) for visual nearest-neighbor on stamp photos.
 * Similar frames (two beauty shots, two stringer stamps) land close in Hamming
 * distance so few-shot retrieval can pick examples that look like this gallery
 * without a vector database.
 */

const HASH_WIDTH = 9
const HASH_HEIGHT = 8

function hexFromBits(bits: number[]): string {
  let hex = ""
  for (let i = 0; i < 16; i++) {
    let nibble = 0
    for (let b = 0; b < 4; b++) {
      if (bits[i * 4 + b]) nibble |= 1 << (3 - b)
    }
    hex += nibble.toString(16)
  }
  return hex
}

export function isDimensionPhotoPhash(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{16}$/.test(value)
}

/** Hamming distance between two 16-char hex dHashes. 64 if either is missing. */
export function phashHammingDistance(a: string | null | undefined, b: string | null | undefined): number {
  if (!isDimensionPhotoPhash(a) || !isDimensionPhotoPhash(b)) return 64
  const left = BigInt(`0x${a}`)
  const right = BigInt(`0x${b}`)
  let xor = left ^ right
  let distance = 0
  while (xor > 0n) {
    xor &= xor - 1n
    distance += 1
  }
  return distance
}

/**
 * Minimum Hamming distance from `example` to any query hash.
 * Missing hashes score 65 so recency/diversity can still pick them after
 * visually similar neighbors.
 */
export function minPhashDistanceToQueries(
  examplePhash: string | null | undefined,
  queryHashes: readonly string[],
): number {
  if (!isDimensionPhotoPhash(examplePhash) || queryHashes.length === 0) return 65
  let best = 64
  for (const query of queryHashes) {
    const distance = phashHammingDistance(examplePhash, query)
    if (distance < best) best = distance
  }
  return best
}

/**
 * Build a 16-hex dHash from an 8-bit grayscale buffer laid out 9×8 (row-major).
 * Each bit is 1 when the pixel is brighter than its right neighbor.
 */
export function dhashFromGrayscale9x8(pixels: Uint8Array | Buffer): string {
  if (pixels.length < HASH_WIDTH * HASH_HEIGHT) {
    throw new Error("dHash needs 72 grayscale pixels (9×8)")
  }
  const bits: number[] = []
  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_WIDTH - 1; x++) {
      const left = pixels[y * HASH_WIDTH + x] ?? 0
      const right = pixels[y * HASH_WIDTH + x + 1] ?? 0
      bits.push(left > right ? 1 : 0)
    }
  }
  return hexFromBits(bits)
}

export async function computeImageDhash(bytes: Uint8Array): Promise<string | null> {
  if (bytes.byteLength < 256) return null
  try {
    const sharp = (await import("sharp")).default
    const pixels = await sharp(Buffer.from(bytes), { failOn: "none" })
      .rotate()
      .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer()
    return dhashFromGrayscale9x8(pixels)
  } catch {
    return null
  }
}
