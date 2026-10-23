import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  orderListingPhotosByCaptureTime,
  readListingPhotoCaptureTime,
} from "./listing-photo-capture-time.ts"

const ORIGINAL = 0x9003
const MODIFIED = 0x0132
const SUBSEC_ORIGINAL = 0x9291

describe("listing photo capture order", () => {
  it("reads the shutter time and ignores a later modify time", async () => {
    const file = jpeg(
      tiff({
        endian: "le",
        ifd0: [{ tag: MODIFIED, text: "2024:06:15 18:00:00" }],
        exif: [{ tag: ORIGINAL, text: "2024:06:15 14:30:00" }],
      }),
    )
    assert.equal(await readListingPhotoCaptureTime(file), Date.UTC(2024, 5, 15, 14, 30, 0))
  })

  it("reads a big-endian TIFF timestamp", async () => {
    const file = jpeg(
      tiff({
        endian: "be",
        exif: [{ tag: ORIGINAL, text: "2020:01:02 03:04:05" }],
      }),
      "board.jpg",
    )
    assert.equal(await readListingPhotoCaptureTime(file), Date.UTC(2020, 0, 2, 3, 4, 5))
  })

  it("orders burst shots inside the same second by the subsecond field", async () => {
    const earlier = jpeg(
      tiff({
        exif: [
          { tag: ORIGINAL, text: "2024:06:15 14:30:00" },
          { tag: SUBSEC_ORIGINAL, text: "100" },
        ],
      }),
      "burst-late-in-finder.jpg",
    )
    const later = jpeg(
      tiff({
        exif: [
          { tag: ORIGINAL, text: "2024:06:15 14:30:00" },
          { tag: SUBSEC_ORIGINAL, text: "900" },
        ],
      }),
      "burst-early-in-finder.jpg",
    )
    const ordered = await orderListingPhotosByCaptureTime([later, earlier])
    assert.deepEqual(
      ordered.map((file) => file.name),
      ["burst-late-in-finder.jpg", "burst-early-in-finder.jpg"],
    )
  })

  it("sorts a newest-first Mac drop from the first shot to the last", async () => {
    const third = jpeg(tiff({ exif: [{ tag: ORIGINAL, text: "2024:01:03 12:00:00" }] }), "third.jpg")
    const first = jpeg(tiff({ exif: [{ tag: ORIGINAL, text: "2024:01:01 09:00:00" }] }), "first.jpg")
    const second = jpeg(tiff({ exif: [{ tag: ORIGINAL, text: "2024:01:02 09:00:00" }] }), "second.jpg")
    const ordered = await orderListingPhotosByCaptureTime([third, second, first])
    assert.deepEqual(
      ordered.map((file) => file.name),
      ["first.jpg", "second.jpg", "third.jpg"],
    )
    assert.equal(ordered[0], first)
  })

  it("keeps undated photos in drop order after the dated ones", async () => {
    const datedLater = jpeg(tiff({ exif: [{ tag: ORIGINAL, text: "2024:04:02 08:00:00" }] }), "b.jpg")
    const plainA = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], "a.jpg", {
      type: "image/jpeg",
    })
    const datedEarlier = jpeg(tiff({ exif: [{ tag: ORIGINAL, text: "2024:04:01 08:00:00" }] }), "c.jpg")
    const plainB = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], "d.jpg", {
      type: "image/jpeg",
    })
    const ordered = await orderListingPhotosByCaptureTime([plainA, datedLater, plainB, datedEarlier])
    assert.deepEqual(
      ordered.map((file) => file.name),
      ["c.jpg", "b.jpg", "a.jpg", "d.jpg"],
    )
  })

  it("leaves the dropped order alone when no photo has a capture time", async () => {
    const a = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], "a.jpg", { type: "image/jpeg" })
    const b = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], "b.jpg", { type: "image/jpeg" })
    const ordered = await orderListingPhotosByCaptureTime([b, a])
    assert.deepEqual(
      ordered.map((file) => file.name),
      ["b.jpg", "a.jpg"],
    )
  })

  it("does not reorder a single photo", async () => {
    const only = jpeg(tiff({ exif: [{ tag: ORIGINAL, text: "2024:05:01 10:00:00" }] }), "only.jpg")
    const ordered = await orderListingPhotosByCaptureTime([only])
    assert.equal(ordered[0], only)
  })

  it("reads DateTimeOriginal from PNG and WebP metadata", async () => {
    const bytes = tiff({ exif: [{ tag: ORIGINAL, text: "2023:11:04 16:45:01" }] })
    const png = pngWithExif(bytes)
    const webp = webpWithExif(bytes)
    const expected = Date.UTC(2023, 10, 4, 16, 45, 1)
    assert.equal(await readListingPhotoCaptureTime(png), expected)
    assert.equal(await readListingPhotoCaptureTime(webp), expected)
  })

  it("reads an XMP DateTimeOriginal when the JPEG has no EXIF IFD", async () => {
    const xml = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<rdf:RDF><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/">
<exif:DateTimeOriginal>2022-08-09T07:06:05</exif:DateTimeOriginal>
</rdf:Description></rdf:RDF>`
    const payload = asciiBytes(`http://ns.adobe.com/xap/1.0/\0${xml}`)
    const file = jpegApp1(payload, "xmp.jpg")
    assert.equal(await readListingPhotoCaptureTime(file), Date.UTC(2022, 7, 9, 7, 6, 5))
  })

  it("reads a HEIC Exif item that lives past the file head", async () => {
    const captured = tiff({ exif: [{ tag: ORIGINAL, text: "2024:03:08 11:22:33" }] })
    const file = heifWithExif({
      exif: concat(u32beBytes(0), captured),
      exifAt: 600_000,
      ilocVersion: 0,
    })
    assert.equal(await readListingPhotoCaptureTime(file), Date.UTC(2024, 2, 8, 11, 22, 33))
  })

  it("reads a HEIC Exif item located with an iloc version 1 base offset", async () => {
    const captured = tiff({
      endian: "be",
      exif: [{ tag: ORIGINAL, text: "2021:12:31 23:59:58" }],
    })
    const prefix = asciiBytes("Exif\0\0")
    const file = heifWithExif({
      exif: concat(u32beBytes(prefix.length), prefix, captured),
      exifAt: 600_000,
      ilocVersion: 1,
    })
    assert.equal(await readListingPhotoCaptureTime(file), Date.UTC(2021, 11, 31, 23, 59, 58))
  })

  it("uses the QuickTime creation date when a HEIC has no Exif item", async () => {
    const file = heifWithAppleCreation("2024-06-15T14:30:00Z")
    assert.equal(await readListingPhotoCaptureTime(file), Date.UTC(2024, 5, 15, 14, 30, 0))
  })
})

type StringTag = { tag: number; text: string }

function tiff(opts: {
  endian?: "le" | "be"
  ifd0?: StringTag[]
  exif?: StringTag[]
}): Uint8Array {
  const le = (opts.endian ?? "le") === "le"
  const ifd0Strings = opts.ifd0 ?? []
  const exifStrings = opts.exif ?? []
  const ifd0Count = ifd0Strings.length + (exifStrings.length ? 1 : 0)
  const ifd0Size = 2 + ifd0Count * 12 + 4
  const exifSize = exifStrings.length ? 2 + exifStrings.length * 12 + 4 : 0
  const ifd0At = 8
  const exifAt = ifd0At + ifd0Size
  const stringsAt = exifAt + exifSize
  const heap = [...ifd0Strings, ...exifStrings].map((tag) => asciiZ(tag.text))
  const heapLen = heap.reduce((sum, text) => sum + (text.length > 4 ? text.length : 0), 0)
  const bytes = new Uint8Array(stringsAt + heapLen)
  bytes[0] = le ? 0x49 : 0x4d
  bytes[1] = le ? 0x49 : 0x4d
  writeU16(bytes, 2, 42, le)
  writeU32(bytes, 4, ifd0At, le)
  writeU16(bytes, ifd0At, ifd0Count, le)

  let entry = ifd0At + 2
  let stringCursor = stringsAt
  const writeString = (tag: number, text: Uint8Array) => {
    writeU16(bytes, entry, tag, le)
    writeU16(bytes, entry + 2, 2, le)
    writeU32(bytes, entry + 4, text.length, le)
    if (text.length <= 4) {
      bytes.set(text, entry + 8)
    } else {
      writeU32(bytes, entry + 8, stringCursor, le)
      bytes.set(text, stringCursor)
      stringCursor += text.length
    }
    entry += 12
  }

  for (const tag of ifd0Strings) writeString(tag.tag, asciiZ(tag.text))
  if (exifStrings.length) {
    writeU16(bytes, entry, 0x8769, le)
    writeU16(bytes, entry + 2, 4, le)
    writeU32(bytes, entry + 4, 1, le)
    writeU32(bytes, entry + 8, exifAt, le)
    entry = exifAt + 2
    writeU16(bytes, exifAt, exifStrings.length, le)
    for (const tag of exifStrings) writeString(tag.tag, asciiZ(tag.text))
  }
  return bytes
}

function jpeg(exifTiff: Uint8Array, name = "shot.jpg"): File {
  return jpegApp1(concat(asciiBytes("Exif\0\0"), exifTiff), name)
}

function jpegApp1(payload: Uint8Array, name: string): File {
  const segLen = 2 + payload.length
  const bytes = new Uint8Array(4 + segLen + 2)
  bytes[0] = 0xff
  bytes[1] = 0xd8
  bytes[2] = 0xff
  bytes[3] = 0xe1
  bytes[4] = (segLen >> 8) & 0xff
  bytes[5] = segLen & 0xff
  bytes.set(payload, 6)
  bytes[bytes.length - 2] = 0xff
  bytes[bytes.length - 1] = 0xd9
  return new File([bytes], name, { type: "image/jpeg" })
}

function pngWithExif(exifTiff: Uint8Array): File {
  const sig = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return new File([concat(sig, pngChunk("IHDR", new Uint8Array(13)), pngChunk("eXIf", exifTiff), pngChunk("IEND", new Uint8Array()))], "shot.png", {
    type: "image/png",
  })
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  writeU32(out, 0, data.length, false)
  out.set(asciiBytes(type), 4)
  out.set(data, 8)
  return out
}

function webpWithExif(exifTiff: Uint8Array): File {
  const payload = concat(asciiBytes("Exif\0\0"), exifTiff)
  const chunk = new Uint8Array(8 + payload.length + (payload.length % 2))
  chunk.set(asciiBytes("EXIF"), 0)
  writeU32(chunk, 4, payload.length, true)
  chunk.set(payload, 8)
  const file = new Uint8Array(12 + chunk.length)
  file.set(asciiBytes("RIFF"), 0)
  writeU32(file, 4, 4 + chunk.length, true)
  file.set(asciiBytes("WEBP"), 8)
  file.set(chunk, 12)
  return new File([file], "shot.webp", { type: "image/webp" })
}

function heifWithExif(opts: { exif: Uint8Array; exifAt: number; ilocVersion: 0 | 1 }): File {
  const itemId = 1
  const infe = isoBox(
    "infe",
    concat(
      Uint8Array.from([0x02, 0x00, 0x00, 0x00]),
      u16beBytes(itemId),
      u16beBytes(0),
      asciiBytes("Exif"),
      Uint8Array.from([0]),
    ),
  )
  const iinf = isoBox(
    "iinf",
    concat(Uint8Array.from([0x00, 0x00, 0x00, 0x00]), u16beBytes(1), infe),
  )
  const ftyp = isoBox("ftyp", concat(asciiBytes("heic"), u32beBytes(0), asciiBytes("mif1")))

  const build = (exifAt: number) => {
    const iloc =
      opts.ilocVersion === 0
        ? ilocV0(itemId, exifAt, opts.exif.length)
        : ilocV1(itemId, exifAt, opts.exif.length)
    const meta = isoBox("meta", concat(Uint8Array.from([0, 0, 0, 0]), iinf, iloc))
    return concat(ftyp, meta)
  }

  const header = build(opts.exifAt)
  if (header.length > opts.exifAt) {
    throw new Error(`HEIC header ${header.length} overlaps Exif at ${opts.exifAt}`)
  }
  const pad = new Uint8Array(opts.exifAt - header.length)
  return new File([concat(header, pad, opts.exif)], "board.heic", { type: "image/heic" })
}

function ilocV0(itemId: number, offset: number, length: number): Uint8Array {
  return isoBox(
    "iloc",
    concat(
      Uint8Array.from([0x00, 0x00, 0x00, 0x00]),
      Uint8Array.from([0x44, 0x00]),
      u16beBytes(1),
      u16beBytes(itemId),
      u16beBytes(0),
      u16beBytes(1),
      u32beBytes(offset),
      u32beBytes(length),
    ),
  )
}

function ilocV1(itemId: number, offset: number, length: number): Uint8Array {
  return isoBox(
    "iloc",
    concat(
      Uint8Array.from([0x01, 0x00, 0x00, 0x00]),
      Uint8Array.from([0x44, 0x40]),
      u16beBytes(1),
      u16beBytes(itemId),
      u16beBytes(0),
      u16beBytes(0),
      u32beBytes(offset),
      u16beBytes(1),
      u32beBytes(0),
      u32beBytes(length),
    ),
  )
}

function heifWithAppleCreation(iso: string): File {
  const keyName = asciiBytes("com.apple.quicktime.creationdate")
  const key = isoBox("mdta", keyName)
  const keys = isoBox(
    "keys",
    concat(Uint8Array.from([0, 0, 0, 0]), u32beBytes(1), key),
  )
  const value = asciiBytes(iso)
  const dataPayload = new Uint8Array(8 + value.length)
  dataPayload[3] = 1
  dataPayload.set(value, 8)
  const data = isoBox("data", dataPayload)
  const item = isoBoxBytes(Uint8Array.from([0, 0, 0, 1]), data)
  const ilst = isoBox("ilst", item)
  const meta = isoBox("meta", concat(Uint8Array.from([0, 0, 0, 0]), keys, ilst))
  const ftyp = isoBox("ftyp", concat(asciiBytes("heic"), u32beBytes(0), asciiBytes("mif1")))
  return new File([concat(ftyp, meta)], "creation.heic", { type: "image/heic" })
}

function isoBox(type: string, payload: Uint8Array): Uint8Array {
  return isoBoxBytes(asciiBytes(type), payload)
}

function isoBoxBytes(type: Uint8Array, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length)
  writeU32(out, 0, out.length, false)
  out.set(type, 4)
  out.set(payload, 8)
  return out
}

function asciiZ(text: string): Uint8Array {
  return asciiBytes(`${text}\0`)
}

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i)
  return out
}

function u16beBytes(value: number): Uint8Array {
  return Uint8Array.from([(value >> 8) & 0xff, value & 0xff])
}

function u32beBytes(value: number): Uint8Array {
  const out = new Uint8Array(4)
  writeU32(out, 0, value, false)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(len)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

function writeU16(bytes: Uint8Array, offset: number, value: number, le: boolean) {
  if (le) {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >> 8) & 0xff
    return
  }
  bytes[offset] = (value >> 8) & 0xff
  bytes[offset + 1] = value & 0xff
}

function writeU32(bytes: Uint8Array, offset: number, value: number, le: boolean) {
  if (le) {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >> 8) & 0xff
    bytes[offset + 2] = (value >> 16) & 0xff
    bytes[offset + 3] = (value >> 24) & 0xff
    return
  }
  bytes[offset] = (value >> 24) & 0xff
  bytes[offset + 1] = (value >> 16) & 0xff
  bytes[offset + 2] = (value >> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}
