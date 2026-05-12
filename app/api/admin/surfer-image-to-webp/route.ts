import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { convertSurferAssetUploadToWebp } from "@/lib/services/surferAssetWebp"
import { SURFER_ASSET_RAW_UPLOAD_MAX_BYTES } from "@/lib/surfers/surfer-asset-limits"

export const maxDuration = 60
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > SURFER_ASSET_RAW_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `File too large (max ${SURFER_ASSET_RAW_UPLOAD_MAX_BYTES / (1024 * 1024)}MB before conversion)`,
        },
        { status: 413 },
      )
    }

    const qRaw = formData.get("rotateQuarterTurns")
    let rotateQuarterTurns = 0
    if (typeof qRaw === "string" && qRaw.trim() !== "") {
      const n = parseInt(qRaw, 10)
      if (!Number.isNaN(n)) rotateQuarterTurns = n
    }
    const legacy180 = formData.get("rotate180")
    if (
      rotateQuarterTurns === 0 &&
      (legacy180 === "1" ||
        legacy180 === "true" ||
        (typeof legacy180 === "string" && legacy180.toLowerCase() === "on"))
    ) {
      rotateQuarterTurns = 2
    }

    const webp = await convertSurferAssetUploadToWebp(buffer, {
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      rotateQuarterTurns,
    })

    return new NextResponse(new Uint8Array(webp), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Conversion failed"
    console.error("[surfer-image-to-webp]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
