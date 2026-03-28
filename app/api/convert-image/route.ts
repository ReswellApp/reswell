import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

export const maxDuration = 60

function bufferLooksLikeHeif(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false
  const brand = buffer.toString("ascii", 8, 12).replace(/\0/g, "").trim()
  return /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|hevm|hevs)$/i.test(brand)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const lowerName = (file.name || "").toLowerCase()

    let jpegBuffer: Buffer

    try {
      jpegBuffer = await sharp(buffer, { failOn: "none" })
        .rotate()
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer()
    } catch (sharpErr) {
      const tryHeic =
        bufferLooksLikeHeif(buffer) ||
        lowerName.endsWith(".heic") ||
        lowerName.endsWith(".heif") ||
        (file.type || "").toLowerCase().includes("heic") ||
        (file.type || "").toLowerCase().includes("heif")

      if (!tryHeic) throw sharpErr

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
      const asBuffer = Buffer.isBuffer(rawJpeg) ? rawJpeg : Buffer.from(rawJpeg)

      jpegBuffer = await sharp(asBuffer, { failOn: "none" })
        .rotate()
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer()
    }

    return new NextResponse(new Uint8Array(jpegBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Conversion failed"
    console.error("[convert-image]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
