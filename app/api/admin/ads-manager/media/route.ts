import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/brands/admin-server"
import { AdsManagerInputError, AdsPlatformError, publicAdsError } from "@/lib/ads/manager/errors"
import { uploadAdsMediaService } from "@/lib/services/adsManager"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** POST /api/admin/ads-manager/media */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Upload a file" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file" }, { status: 400 })
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const data = await uploadAdsMediaService({
      role: form.get("role"),
      filename: file.name,
      mime: file.type,
      bytes,
    })
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error(
      "[ads-manager]",
      JSON.stringify({
        userId: gate.ctx.user.id,
        op: "upload-media",
        at: new Date().toISOString(),
        bytes: file.size,
        message: publicAdsError(error).slice(0, 300),
      }),
    )
    if (error instanceof AdsManagerInputError) {
      return NextResponse.json({ error: publicAdsError(error) }, { status: 400 })
    }
    if (error instanceof AdsPlatformError) {
      return NextResponse.json({ error: publicAdsError(error) }, { status: 502 })
    }
    return NextResponse.json({ error: "Could not upload that file" }, { status: 500 })
  }
}
