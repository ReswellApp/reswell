/**
 * Orders a dropped batch of listing photos by when the camera took them.
 *
 * macOS gives the browser Finder's order, which is often newest-first, so a
 * handful of board shots land backwards. Capture time is the camera clock in
 * the file (EXIF DateTimeOriginal, then digitized time, then the TIFF modify
 * time). `File.lastModified` is not used — a Mac export stamps that with the
 * copy time, so a whole batch can share one instant.
 *
 * Photos with no capture time keep their relative drop order and follow the
 * dated ones. A single photo is left as-is.
 */

const MAX_METADATA_BYTES = 4 * 1024 * 1024
const MAX_EXIF_SEGMENT_BYTES = 128 * 1024
const MAX_HEIF_META_BYTES = 2 * 1024 * 1024
const MAX_EXIF_ITEM_BYTES = 256 * 1024

const EXIF_ORIGINAL = 0x9003
const EXIF_DIGITIZED = 0x9004
const TIFF_DATETIME = 0x0132
const EXIF_IFD_POINTER = 0x8769
const SUBSEC_ORIGINAL = 0x9291
const SUBSEC_DIGITIZED = 0x9292
const SUBSEC_MODIFY = 0x9290

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  7: 1,
  9: 4,
  10: 8,
}

type CaptureStamp = {
  /** Camera-clock milliseconds, comparable within one shoot. */
  ms: number
  /** Lower wins: original, then digitized, then QuickTime creation, then modify time. */
  rank: number
}

type TagValue = {
  type: number
  count: number
  valueAt: number
}

type IsoBox = {
  type: string
  contentStart: number
  end: number
}

type IlocExtent = {
  construction: number
  offset: number
  length: number
}

export async function readListingPhotoCaptureTime(file: Blob): Promise<number | null> {
  if (!file.size) return null
  try {
    const head = await readSlice(file, 0, Math.min(file.size, 32))
    const kind = metadataKind(head, fileName(file))
    if (kind === "jpeg") return readJpegCaptureTime(file)
    if (kind === "png") return readPngCaptureTime(file)
    if (kind === "webp") return readWebpCaptureTime(file)
    if (kind === "tiff") {
      const bytes = await readSlice(file, 0, Math.min(file.size, MAX_METADATA_BYTES))
      return readTiffCapture(bytes)?.ms ?? null
    }
    if (kind === "heif") return readHeifCaptureTime(file)
    return scanExifPrefix(file)
  } catch {
    return null
  }
}

/**
 * Oldest capture first. Returns the same File objects; does not copy bytes.
 * One photo, or a batch whose files all lack a capture time, stays in the
 * order the browser handed over.
 */
export async function orderListingPhotosByCaptureTime(files: File[]): Promise<File[]> {
  if (files.length < 2) return files
  const takenAt = await Promise.all(
    files.map(async (file) => {
      try {
        return await readListingPhotoCaptureTime(file)
      } catch {
        return null
      }
    }),
  )
  return files
    .map((file, index) => ({
      file,
      index,
      takenAt: takenAt[index] ?? null,
    }))
    .sort((a, b) => {
      if (a.takenAt != null && b.takenAt != null && a.takenAt !== b.takenAt) {
        return a.takenAt < b.takenAt ? -1 : 1
      }
      if (a.takenAt != null && b.takenAt == null) return -1
      if (a.takenAt == null && b.takenAt != null) return 1
      return a.index - b.index
    })
    .map((row) => row.file)
}

function fileName(file: Blob): string {
  return file instanceof File ? file.name : ""
}

async function readSlice(file: Blob, start: number, length: number): Promise<Uint8Array> {
  if (length <= 0 || start >= file.size) return new Uint8Array()
  const end = Math.min(file.size, start + length)
  return new Uint8Array(await file.slice(start, end).arrayBuffer())
}

function metadataKind(
  head: Uint8Array,
  name: string,
): "jpeg" | "png" | "webp" | "tiff" | "heif" | "unknown" {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg"
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return "png"
  }
  if (head.length >= 12 && fourcc(head, 0) === "RIFF" && fourcc(head, 8) === "WEBP") return "webp"
  if (head.length >= 4) {
    const leTiff = head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00
    const beTiff = head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a
    if (leTiff || beTiff) return "tiff"
  }
  if (head.length >= 12 && fourcc(head, 4) === "ftyp") {
    const brand = fourcc(head, 8).toLowerCase()
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|hevm|hevs|avif|avis)$/.test(brand)) {
      return "heif"
    }
  }
  const ext = name.toLowerCase()
  if (/\.(jpe?g|jfif)$/.test(ext)) return "jpeg"
  if (ext.endsWith(".png")) return "png"
  if (ext.endsWith(".webp")) return "webp"
  if (/\.tiff?$/.test(ext)) return "tiff"
  if (/\.(heic|heif|avif)$/.test(ext)) return "heif"
  return "unknown"
}

async function readJpegCaptureTime(file: Blob): Promise<number | null> {
  let offset = 2
  let best: CaptureStamp | null = null
  while (offset + 4 <= file.size && offset < MAX_METADATA_BYTES) {
    const markerHead = await readSlice(file, offset, 4)
    if (markerHead.length < 4 || markerHead[0] !== 0xff) break
    const marker = markerHead[1] ?? 0
    if (marker === 0xff) {
      offset += 1
      continue
    }
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const segLen = ((markerHead[2] ?? 0) << 8) | (markerHead[3] ?? 0)
    if (segLen < 2) break
    if (marker === 0xe1) {
      const payloadLen = Math.min(segLen - 2, MAX_EXIF_SEGMENT_BYTES)
      const payload = await readSlice(file, offset + 4, payloadLen)
      const stamp = stampFromJpegApp1(payload)
      best = preferStamp(best, stamp)
      if (best?.rank === 0) return best.ms
    }
    offset += 2 + segLen
  }
  return best?.ms ?? null
}

function stampFromJpegApp1(payload: Uint8Array): CaptureStamp | null {
  if (payload.length >= 14 && fourcc(payload, 0) === "Exif") {
    return readTiffCapture(payload.subarray(6))
  }
  if (payload.length > 30 && ascii(payload, 0, 28) === "http://ns.adobe.com/xap/1.0/") {
    const xml = new TextDecoder("utf-8", { fatal: false }).decode(payload.subarray(29))
    const ms = xmpCaptureMs(xml)
    if (ms != null) return { ms, rank: 0 }
  }
  return null
}

function xmpCaptureMs(xml: string): number | null {
  const original = xmlDate(xml, "DateTimeOriginal")
  if (original != null) return original
  return xmlDate(xml, "DateTimeDigitized")
}

function xmlDate(xml: string, tag: string): number | null {
  const pattern = new RegExp(
    `${tag}(?:"\\s*>|>|\\s*=\\s*")(\\d{4}[-:]\\d{2}[-:]\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?)`,
  )
  const match = pattern.exec(xml)
  if (!match?.[1]) return null
  return parseCaptureTimestamp(match[1], null)
}

async function readPngCaptureTime(file: Blob): Promise<number | null> {
  let offset = 8
  while (offset + 12 <= file.size && offset < MAX_METADATA_BYTES) {
    const head = await readSlice(file, offset, 8)
    if (head.length < 8) break
    const len = u32be(head, 0)
    const type = fourcc(head, 4)
    if (type === "eXIf" && len > 0 && len <= MAX_EXIF_SEGMENT_BYTES) {
      const data = await readSlice(file, offset + 8, len)
      return readExifBlock(data)?.ms ?? null
    }
    if (type === "IDAT" || type === "IEND") break
    if (len > file.size) break
    offset += 12 + len
  }
  return null
}

async function readWebpCaptureTime(file: Blob): Promise<number | null> {
  if (file.size < 12) return null
  let offset = 12
  while (offset + 8 <= file.size && offset < MAX_METADATA_BYTES) {
    const head = await readSlice(file, offset, 8)
    if (head.length < 8) break
    const type = fourcc(head, 0)
    const len = u32le(head, 4)
    if ((type === "EXIF" || type === "exif") && len > 0 && len <= MAX_EXIF_SEGMENT_BYTES) {
      const data = await readSlice(file, offset + 8, len)
      return readExifBlock(data)?.ms ?? null
    }
    if (len > file.size) break
    offset += 8 + len + (len % 2)
  }
  return null
}

async function readHeifCaptureTime(file: Blob): Promise<number | null> {
  let offset = 0
  let best: CaptureStamp | null = null
  while (offset + 8 <= file.size) {
    const header = await readSlice(file, offset, 16)
    const parsed = parseFileBoxHeader(header, offset, file.size)
    if (!parsed || parsed.next <= offset) break
    if (parsed.type === "meta") {
      const meta = await readSlice(file, offset, Math.min(parsed.totalSize, MAX_HEIF_META_BYTES))
      const stamp = await captureFromHeifMeta(file, meta, offset)
      best = preferStamp(best, stamp)
      if (best?.rank === 0) return best.ms
    }
    offset = parsed.next
  }
  if (best) return best.ms
  return scanExifPrefix(file)
}

async function captureFromHeifMeta(
  file: Blob,
  meta: Uint8Array,
  metaFileOffset: number,
): Promise<CaptureStamp | null> {
  const root = readBoxAt(meta, 0, meta.length)
  if (!root) return null
  const children = childBoxes(meta, root.contentStart + 4, root.end)
  let idatFileOffset: number | null = null
  const exifIds: number[] = []
  let iloc: IsoBox | null = null
  for (const child of children) {
    if (child.type === "idat") idatFileOffset = metaFileOffset + child.contentStart
    if (child.type === "iinf") exifIds.push(...readExifItemIds(meta, child))
    if (child.type === "iloc") iloc = child
  }

  let best: CaptureStamp | null = null
  if (iloc && exifIds.length) {
    const extentsById = readIloc(meta, iloc)
    for (const id of exifIds) {
      const extents = extentsById?.get(id)
      if (!extents?.length) continue
      const bytes = await readIlocExtents(file, extents, idatFileOffset)
      if (!bytes) continue
      best = preferStamp(best, readExifBlock(bytes))
      if (best?.rank === 0) break
    }
  }

  const appleMs = readAppleCreationMs(meta, children)
  if (appleMs != null) best = preferStamp(best, { ms: appleMs, rank: 2 })
  return best
}

async function readIlocExtents(
  file: Blob,
  extents: IlocExtent[],
  idatFileOffset: number | null,
): Promise<Uint8Array | null> {
  const parts: Uint8Array[] = []
  let total = 0
  for (const extent of extents) {
    let pos = extent.offset
    if (extent.construction === 1) {
      if (idatFileOffset == null) return null
      pos += idatFileOffset
    } else if (extent.construction !== 0) {
      return null
    }
    const wanted = extent.length > 0 ? extent.length : 64 * 1024
    const capped = Math.min(wanted, MAX_EXIF_ITEM_BYTES - total)
    if (capped <= 0 || pos < 0 || pos >= file.size) break
    parts.push(await readSlice(file, pos, capped))
    total += capped
  }
  if (!parts.length) return null
  return concatBytes(parts)
}

function readExifItemIds(bytes: Uint8Array, iinf: IsoBox): number[] {
  if (iinf.contentStart + 6 > iinf.end) return []
  const version = bytes[iinf.contentStart] ?? 0
  const countWidth = version === 0 ? 2 : 4
  const entriesAt = iinf.contentStart + 4 + countWidth
  if (entriesAt > iinf.end) return []
  const ids: number[] = []
  for (const entry of childBoxes(bytes, entriesAt, iinf.end)) {
    if (entry.type !== "infe") continue
    const info = readInfe(bytes, entry)
    if (info?.type === "Exif") ids.push(info.id)
  }
  return ids
}

function readInfe(bytes: Uint8Array, entry: IsoBox): { id: number; type: string } | null {
  if (entry.contentStart + 4 > entry.end) return null
  const version = bytes[entry.contentStart] ?? 0
  let cursor = entry.contentStart + 4
  if (version < 2) return null
  const id = version === 2 ? u16be(bytes, cursor) : u32be(bytes, cursor)
  cursor += version === 2 ? 2 : 4
  cursor += 2
  if (cursor + 4 > entry.end) return null
  return { id, type: fourcc(bytes, cursor) }
}

function readIloc(bytes: Uint8Array, iloc: IsoBox): Map<number, IlocExtent[]> | null {
  const end = iloc.end
  let cursor = iloc.contentStart
  if (cursor + 8 > end) return null
  const version = bytes[cursor] ?? 0
  cursor += 4
  const sizeByte = bytes[cursor] ?? 0
  const offsetSize = sizeByte >> 4
  const lengthSize = sizeByte & 0x0f
  cursor += 1
  const sizeByte2 = bytes[cursor] ?? 0
  const baseOffsetSize = sizeByte2 >> 4
  const indexSize = version === 1 || version === 2 ? sizeByte2 & 0x0f : 0
  cursor += 1

  const countRead = version < 2 ? readBe(bytes, cursor, 2, end) : readBe(bytes, cursor, 4, end)
  if (!countRead || countRead.value > 64) return null
  cursor = countRead.next

  const map = new Map<number, IlocExtent[]>()
  for (let i = 0; i < countRead.value; i++) {
    const idRead = version < 2 ? readBe(bytes, cursor, 2, end) : readBe(bytes, cursor, 4, end)
    if (!idRead) return null
    cursor = idRead.next
    let construction = 0
    if (version === 1 || version === 2) {
      const method = readBe(bytes, cursor, 2, end)
      if (!method) return null
      construction = method.value & 0x0f
      cursor = method.next
    }
    const dataRef = readBe(bytes, cursor, 2, end)
    if (!dataRef) return null
    cursor = dataRef.next
    const base = readBe(bytes, cursor, baseOffsetSize, end)
    if (!base) return null
    cursor = base.next
    const extentCount = readBe(bytes, cursor, 2, end)
    if (!extentCount || extentCount.value > 8) return null
    cursor = extentCount.next
    const extents: IlocExtent[] = []
    for (let e = 0; e < extentCount.value; e++) {
      if ((version === 1 || version === 2) && indexSize > 0) {
        const index = readBe(bytes, cursor, indexSize, end)
        if (!index) return null
        cursor = index.next
      }
      const off = readBe(bytes, cursor, offsetSize, end)
      if (!off) return null
      cursor = off.next
      const len = readBe(bytes, cursor, lengthSize, end)
      if (!len) return null
      cursor = len.next
      extents.push({
        construction,
        offset: base.value + off.value,
        length: len.value,
      })
    }
    map.set(idRead.value, extents)
  }
  return map
}

function readAppleCreationMs(bytes: Uint8Array, children: IsoBox[]): number | null {
  const keys = children.find((box) => box.type === "keys")
  const ilst = children.find((box) => box.type === "ilst")
  if (!keys || !ilst || keys.contentStart + 8 > keys.end) return null
  const count = u32be(bytes, keys.contentStart + 4)
  if (count > 64) return null
  const names: string[] = []
  let cursor = keys.contentStart + 8
  for (let i = 0; i < count; i++) {
    const box = readBoxAt(bytes, cursor, keys.end)
    if (!box) return null
    names.push(box.type === "mdta" ? ascii(bytes, box.contentStart, box.end - box.contentStart) : "")
    cursor = box.end
  }
  const index = names.indexOf("com.apple.quicktime.creationdate")
  if (index < 0) return null
  const item = childBoxes(bytes, ilst.contentStart, ilst.end)[index]
  if (!item) return null
  const data = childBoxes(bytes, item.contentStart, item.end).find((box) => box.type === "data")
  if (!data || data.contentStart + 8 >= data.end) return null
  const text = ascii(bytes, data.contentStart + 8, data.end - (data.contentStart + 8))
  return parseCaptureTimestamp(text, null)
}

async function scanExifPrefix(file: Blob): Promise<number | null> {
  const window = await readSlice(file, 0, Math.min(file.size, 512 * 1024))
  const needle = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
  let from = 0
  while (from < window.length) {
    const at = indexOfBytes(window, needle, from)
    if (at < 0) return null
    const stamp = readTiffCapture(window.subarray(at + 6))
    if (stamp) return stamp.ms
    from = at + 1
  }
  return null
}

function readExifBlock(block: Uint8Array): CaptureStamp | null {
  if (block.length >= 14 && fourcc(block, 0) === "Exif") {
    return readTiffCapture(block.subarray(6))
  }
  if (block.length >= 16) {
    const skip = u32be(block, 0)
    if (skip <= 64 && 4 + skip + 8 <= block.length) {
      const stamped = readTiffCapture(block.subarray(4 + skip))
      if (stamped) return stamped
    }
    if (skip >= 8 && skip + 8 <= block.length) {
      const stamped = readTiffCapture(block.subarray(skip))
      if (stamped) return stamped
    }
  }
  return readTiffCapture(block)
}

function readTiffCapture(tiff: Uint8Array): CaptureStamp | null {
  if (tiff.length < 8) return null
  const le = tiff[0] === 0x49 && tiff[1] === 0x49
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d
  if (!le && !be) return null
  if (u16(tiff, 2, le) !== 42) return null
  const ifd0At = u32(tiff, 4, le)
  const ifd0 = readIfd(tiff, ifd0At, le)
  if (!ifd0) return null
  const exifAt = readTagLong(tiff, ifd0.get(EXIF_IFD_POINTER), le)
  const exif = exifAt == null ? new Map<number, TagValue>() : (readIfd(tiff, exifAt, le) ?? new Map())
  return bestStamp(tiff, ifd0, exif)
}

function bestStamp(
  tiff: Uint8Array,
  ifd0: Map<number, TagValue>,
  exif: Map<number, TagValue>,
): CaptureStamp | null {
  const groups: Array<[number, number, number]> = [
    [EXIF_ORIGINAL, SUBSEC_ORIGINAL, 0],
    [EXIF_DIGITIZED, SUBSEC_DIGITIZED, 1],
    [TIFF_DATETIME, SUBSEC_MODIFY, 3],
  ]
  for (const [dateTag, subTag, rank] of groups) {
    const date = readTagString(tiff, exif.get(dateTag) ?? ifd0.get(dateTag))
    if (!date) continue
    const sub = readTagString(tiff, exif.get(subTag) ?? ifd0.get(subTag))
    const ms = parseCaptureTimestamp(date, sub)
    if (ms != null) return { ms, rank }
  }
  return null
}

function readIfd(tiff: Uint8Array, offset: number, le: boolean): Map<number, TagValue> | null {
  if (offset <= 0 || offset + 2 > tiff.length) return null
  const count = u16(tiff, offset, le)
  if (count > 128 || offset + 2 + count * 12 > tiff.length) return null
  const tags = new Map<number, TagValue>()
  for (let i = 0; i < count; i++) {
    const entry = offset + 2 + i * 12
    const tag = u16(tiff, entry, le)
    const type = u16(tiff, entry + 2, le)
    const n = u32(tiff, entry + 4, le)
    const typeSize = TYPE_SIZE[type] ?? 0
    if (typeSize === 0 || n > 4096) continue
    const byteCount = typeSize * n
    const valueAt = byteCount <= 4 ? entry + 8 : u32(tiff, entry + 8, le)
    tags.set(tag, { type, count: n, valueAt })
  }
  return tags
}

function readTagString(tiff: Uint8Array, tag: TagValue | undefined): string | null {
  if (!tag || tag.type !== 2 || tag.count === 0) return null
  const count = Math.min(tag.count, 64)
  if (tag.valueAt < 0 || tag.valueAt + count > tiff.length) return null
  const text = ascii(tiff, tag.valueAt, count).replace(/\0/g, "").trim()
  return text || null
}

function readTagLong(tiff: Uint8Array, tag: TagValue | undefined, le: boolean): number | null {
  if (!tag || (tag.type !== 4 && tag.type !== 9) || tag.count < 1) return null
  if (tag.valueAt < 0 || tag.valueAt + 4 > tiff.length) return null
  const value = u32(tiff, tag.valueAt, le)
  return value > 0 ? value : null
}

function parseCaptureTimestamp(raw: string, subsec: string | null | undefined): number | null {
  const text = raw.trim().replace(/\0/g, "")
  if (!text) return null
  const match =
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/.exec(text) ??
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/.exec(text)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (year < 1980 || year > 2100) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour > 23 || minute > 59 || second > 60) return null
  const fracSource = subsec?.trim() ? subsec : match[7]
  const millis = fractionMillis(fracSource)
  const utc = Date.UTC(year, month - 1, day, hour, minute, Math.min(second, 59), millis)
  if (!Number.isFinite(utc)) return null
  const check = new Date(utc)
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null
  }
  return utc
}

function fractionMillis(frac: string | undefined): number {
  if (!frac) return 0
  const digits = frac.replace(/\D/g, "").slice(0, 3)
  if (!digits) return 0
  const n = Number(digits.padEnd(3, "0"))
  return Number.isFinite(n) ? n : 0
}

function preferStamp(current: CaptureStamp | null, next: CaptureStamp | null): CaptureStamp | null {
  if (!next) return current
  if (!current || next.rank < current.rank) return next
  return current
}

function parseFileBoxHeader(
  header: Uint8Array,
  fileOffset: number,
  fileSize: number,
): { type: string; headerSize: number; totalSize: number; next: number } | null {
  if (header.length < 8) return null
  let totalSize = u32be(header, 0)
  let headerSize = 8
  if (totalSize === 1) {
    if (header.length < 16) return null
    totalSize = u32be(header, 8) * 2 ** 32 + u32be(header, 12)
    headerSize = 16
  } else if (totalSize === 0) {
    totalSize = fileSize - fileOffset
  }
  if (!Number.isFinite(totalSize) || totalSize < headerSize) return null
  return {
    type: fourcc(header, 4),
    headerSize,
    totalSize,
    next: fileOffset + totalSize,
  }
}

function readBoxAt(bytes: Uint8Array, offset: number, limit: number): IsoBox | null {
  if (offset < 0 || offset + 8 > limit || offset + 8 > bytes.length) return null
  let size = u32be(bytes, offset)
  let headerSize = 8
  if (size === 1) {
    if (offset + 16 > limit || offset + 16 > bytes.length) return null
    size = u32be(bytes, offset + 8) * 2 ** 32 + u32be(bytes, offset + 12)
    headerSize = 16
  } else if (size === 0) {
    size = limit - offset
  }
  if (!Number.isFinite(size) || size < headerSize) return null
  const end = offset + size
  if (end > limit || end > bytes.length) return null
  return { type: fourcc(bytes, offset + 4), contentStart: offset + headerSize, end }
}

function childBoxes(bytes: Uint8Array, start: number, end: number): IsoBox[] {
  const out: IsoBox[] = []
  let cursor = start
  const limit = Math.min(end, bytes.length)
  while (cursor + 8 <= limit && out.length < 256) {
    const box = readBoxAt(bytes, cursor, limit)
    if (!box || box.end <= cursor) break
    out.push(box)
    cursor = box.end
  }
  return out
}

function readBe(
  bytes: Uint8Array,
  offset: number,
  size: number,
  end: number,
): { value: number; next: number } | null {
  if (size === 0) return { value: 0, next: offset }
  if (offset < 0 || offset + size > end || offset + size > bytes.length) return null
  if (size === 1) return { value: bytes[offset] ?? 0, next: offset + 1 }
  if (size === 2) return { value: u16be(bytes, offset), next: offset + 2 }
  if (size === 4) return { value: u32be(bytes, offset), next: offset + 4 }
  if (size === 8) {
    return { value: u32be(bytes, offset) * 2 ** 32 + u32be(bytes, offset + 4), next: offset + 8 }
  }
  return null
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(len)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

function indexOfBytes(hay: Uint8Array, needle: number[], from: number): number {
  const last = hay.length - needle.length
  for (let i = from; i <= last; i++) {
    let found = true
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        found = false
        break
      }
    }
    if (found) return i
  }
  return -1
}

function fourcc(bytes: Uint8Array, offset: number): string {
  if (offset < 0 || offset + 4 > bytes.length) return ""
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  )
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || length <= 0 || offset + length > bytes.length) return ""
  let out = ""
  const end = offset + length
  for (let i = offset; i < end; i++) {
    const code = bytes[i] ?? 0
    if (code === 0) break
    out += String.fromCharCode(code)
  }
  return out
}

function u16(bytes: Uint8Array, offset: number, le: boolean): number {
  if (offset < 0 || offset + 2 > bytes.length) return 0
  const a = bytes[offset] ?? 0
  const b = bytes[offset + 1] ?? 0
  return le ? a | (b << 8) : (a << 8) | b
}

function u32(bytes: Uint8Array, offset: number, le: boolean): number {
  if (offset < 0 || offset + 4 > bytes.length) return 0
  const a = bytes[offset] ?? 0
  const b = bytes[offset + 1] ?? 0
  const c = bytes[offset + 2] ?? 0
  const d = bytes[offset + 3] ?? 0
  return le ? (a | (b << 8) | (c << 16) | (d << 24)) >>> 0 : u32be(bytes, offset)
}

function u16be(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.length) return 0
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)
}

function u32be(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) return 0
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  )
}

function u32le(bytes: Uint8Array, offset: number): number {
  return u32(bytes, offset, true)
}
